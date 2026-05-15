/**
 * Master Test Runner — discovers projects and runs validation layers in order.
 *
 * Usage:
 *   node scripts/test-all.ts [options]
 *
 * Validation layers:
 *   L1: Lint + typecheck (repo-level and per-project)
 *   L2: Unit tests (per-project `npm test`)
 *   L3: Contract compliance (start component + validate against OpenAPI spec)
 *   L4: Container builds (build Docker images + health check)
 *   L5: Integration tests (compose-based inter-service)
 *   L6: E2E local (full E2E against compose)
 *   L7: Generator validation (generate --dry-run + drift check)
 *   L8: Terraform validation (terraform fmt -check && validate)
 *
 * Stops at the first layer that fails (unless --continue-on-error).
 */

import { execFile, type ChildProcess, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync, unlinkSync } from 'node:fs';
import { hostname, platform, tmpdir } from 'node:os';
import { resolve, relative, basename } from 'node:path';
import { runComposeTests } from './compose-test-runner.ts';
import { validateSamples } from './lib/generator/validator.ts';
import { generate } from './lib/generator/index.ts';
import { ensureDeploy } from './deploy-reference-architecture.ts';
import { ensureAzurecliVolume, fixAzurecliPermissions, MOCK_MAP } from './lib/compose-helpers.ts';
import { DEPLOYMENT_STRATEGIES_ROOT, REFERENCE_ARCHITECTURES_ROOT, listGeneratedStrategyDirs } from './lib/paths.ts';

const execFileAsync = promisify(execFile);

// ─── Types ──────────────────────────────────────────────────────────────

type LayerName = 'L1' | 'L2' | 'L3' | 'L4' | 'L5' | 'L6' | 'L7' | 'L8';

interface LayerResult {
  layer: LayerName;
  description: string;
  passed: boolean;
  durationMs: number;
  details: StepResult[];
  skipped?: boolean | undefined;
  skipReason?: string | undefined;
}

interface StepResult {
  name: string;
  passed: boolean;
  durationMs: number;
  output?: string | undefined;
  error?: string | undefined;
}

interface RunOptions {
  /** Layers to run (default: all) */
  layers: LayerName[];
  /** Specific deployment strategy to test */
  strategy?: string | undefined;
  /** Continue running layers even if one fails */
  continueOnError?: boolean | undefined;
}

// ─── Constants ──────────────────────────────────────────────────────────

const REPO_ROOT = resolve(import.meta.dirname ?? '.', '..');

/**
 * Get the IP address that sibling Docker containers can use to reach
 * services running in this process (e.g., the ai-mock server).
 *
 * In devcontainer and other nested-Docker environments, we discover our
 * own container's IP on the Docker bridge network. On bare metal, 127.0.0.1
 * works with --network=host, but we prefer the bridge approach since it
 * works everywhere.
 *
 * Falls back to the Docker bridge gateway IP, then 127.0.0.1.
 */
async function getHostIPForDocker(): Promise<string> {
  // Docker Desktop (macOS/Windows) exposes host services via host.docker.internal.
  // Prefer this first to avoid brittle bridge-gateway assumptions.
  const os = platform();
  if (os === 'darwin' || os === 'win32') {
    return 'host.docker.internal';
  }

  // Try to discover our own container IP (works when running in a container)
  try {
    const hn = hostname();
    const result = await runCommand(
      'docker',
      ['inspect', '-f', '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}', hn],
      REPO_ROOT,
      5_000
    );
    const ip = result.stdout.trim();
    if (ip && /^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) {
      return ip;
    }
  } catch {
    // Not in a container
  }

  // Fallback: Docker bridge gateway (bare metal)
  try {
    const result = await runCommand(
      'docker',
      ['network', 'inspect', 'bridge', '--format', '{{(index .IPAM.Config 0).Gateway}}'],
      REPO_ROOT,
      5_000
    );
    if (result.success && result.stdout.trim()) {
      return result.stdout.trim();
    }
  } catch {
    // Fall through
  }

  return '127.0.0.1';
}

/**
 * Discover a Docker container's IP on the bridge network.
 * Returns null if the container isn't running or the IP can't be determined.
 */
async function discoverContainerIP(containerId: string): Promise<string | null> {
  try {
    const result = await runCommand(
      'docker',
      ['inspect', '-f', '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}', containerId],
      REPO_ROOT,
      5_000
    );
    const ip = result.stdout.trim();
    if (ip && /^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) {
      return ip;
    }
  } catch {
    // Fall through
  }
  return null;
}

interface DockerOperationalStatus {
  ok: boolean;
  reason?: string | undefined;
}

let dockerOperationalCache: DockerOperationalStatus | null = null;

/**
 * Determine whether Docker is actually usable for build/run workflows.
 * `docker info` alone is not enough in some environments (e.g., no registry access).
 */
async function getDockerOperationalStatus(): Promise<DockerOperationalStatus> {
  if (dockerOperationalCache) return dockerOperationalCache;

  const info = await runCommand('docker', ['info'], REPO_ROOT, 10_000);
  if (!info.success) {
    dockerOperationalCache = { ok: false, reason: 'Docker is not available' };
    return dockerOperationalCache;
  }

  const smokeTag = `caira-docker-smoke-${Date.now()}`;
  const smokeDockerfile = resolve(
    REPO_ROOT,
    'testing',
    'container-health',
    'tests',
    'fixtures',
    'healthy',
    'Dockerfile'
  );
  const smokeContext = resolve(REPO_ROOT, 'testing', 'container-health', 'tests', 'fixtures', 'healthy');

  const build = await runCommand(
    'docker',
    ['build', '-f', smokeDockerfile, '-t', smokeTag, smokeContext],
    REPO_ROOT,
    60_000
  );
  if (!build.success) {
    await runCommand('docker', ['rmi', '-f', smokeTag], REPO_ROOT, 10_000);
    dockerOperationalCache = {
      ok: false,
      reason: 'Docker build smoke check failed'
    };
    return dockerOperationalCache;
  }

  const run = await runCommand(
    'docker',
    ['run', '--rm', '--entrypoint', 'sh', smokeTag, '-c', 'echo smoke-ok'],
    REPO_ROOT,
    15_000
  );

  await runCommand('docker', ['rmi', '-f', smokeTag], REPO_ROOT, 10_000);

  if (!run.success) {
    dockerOperationalCache = {
      ok: false,
      reason: 'Docker runtime smoke check failed'
    };
    return dockerOperationalCache;
  }

  dockerOperationalCache = { ok: true };
  return dockerOperationalCache;
}

const ALL_LAYERS: LayerName[] = ['L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7', 'L8'];

/** Default layers for `test:full` — excludes L6 (Azure E2E) which needs real Azure infra. */
const DEFAULT_LAYERS: LayerName[] = ['L1', 'L2', 'L3', 'L4', 'L5', 'L7', 'L8'];

const LAYER_DESCRIPTIONS: Record<LayerName, string> = {
  L1: 'Lint & Typecheck',
  L2: 'Unit Tests',
  L3: 'Contract Compliance',
  L4: 'Container Builds',
  L5: 'E2E Mock (Compose)',
  L6: 'E2E Local + Azure',
  L7: 'Generator Validation',
  L8: 'Terraform Validation'
};

/** Layers that require Azure login */
const AZURE_REQUIRED_LAYERS: LayerName[] = ['L6'];

/**
 * Directories to exclude from project discovery.
 * These are not self-contained projects with test scripts.
 */
const EXCLUDED_DIRS = new Set(['node_modules', '.git', '.devcontainer', '.planning', 'dist', 'docs', '.github']);

// ─── Helpers ────────────────────────────────────────────────────────────

function log(message: string): void {
  process.stdout.write(`${message}\n`);
}

function logStep(message: string): void {
  process.stdout.write(`  ${message}\n`);
}

async function runCommand(
  cmd: string,
  args: string[],
  cwd: string,
  timeoutMs = 120_000
): Promise<{ success: boolean; stdout: string; stderr: string }> {
  try {
    const result = await execFileAsync(cmd, args, {
      cwd,
      timeout: timeoutMs,
      maxBuffer: 10 * 1024 * 1024,
      env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' }
    });
    return { success: true, stdout: result.stdout, stderr: result.stderr };
  } catch (err: unknown) {
    const error = err as { stdout?: string; stderr?: string; message?: string; code?: number };
    return {
      success: false,
      stdout: error.stdout ?? '',
      stderr: error.stderr ?? error.message ?? String(err)
    };
  }
}

async function isAzureLoggedIn(): Promise<boolean> {
  try {
    await execFileAsync('az', ['account', 'show', '--query', 'id', '-o', 'tsv']);
    return true;
  } catch {
    return false;
  }
}

// ─── Project Discovery ──────────────────────────────────────────────────

interface Project {
  name: string;
  dir: string;
  relativePath: string;
  hasTest: boolean;
  hasLint: boolean;
  hasTypecheck: boolean;
}

/**
 * Discover all self-contained projects in the repo.
 * A project is a directory with a package.json that has scripts.
 */
function discoverProjects(): Project[] {
  const projects: Project[] = [];

  function walk(dir: string): void {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (EXCLUDED_DIRS.has(entry.name)) continue;

      const fullPath = resolve(dir, entry.name);
      const pkgPath = resolve(fullPath, 'package.json');

      if (existsSync(pkgPath)) {
        try {
          const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8')) as {
            name?: string;
            scripts?: Record<string, string>;
          };
          const scripts = pkg.scripts ?? {};

          // Skip the root package.json (it's not a self-contained project)
          if (fullPath === REPO_ROOT) continue;

          projects.push({
            name: pkg.name ?? basename(fullPath),
            dir: fullPath,
            relativePath: relative(REPO_ROOT, fullPath),
            hasTest: 'test' in scripts,
            hasLint: 'lint' in scripts,
            hasTypecheck: 'typecheck' in scripts
          });
        } catch {
          // Invalid package.json — skip
        }

        // Don't descend into projects (they manage their own subdirs)
        continue;
      }

      // No package.json here — keep looking deeper
      walk(fullPath);
    }
  }

  walk(REPO_ROOT);
  return projects.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}

// ─── .NET Test Project Discovery ────────────────────────────────────────

interface DotnetTestProject {
  /** Display name (e.g., "CairaAgent.Tests") */
  name: string;
  /** Absolute path to the .csproj file */
  csprojPath: string;
  /** Absolute path to the project directory */
  dir: string;
  /** Relative path from repo root (e.g., "components/agent/csharp/microsoft-agent-framework.Tests") */
  relativePath: string;
}

/**
 * Discover .NET test projects in the repo.
 * A .NET test project is a directory containing a *.Tests.csproj file.
 * Excludes deployment-strategies/ and other non-source directories.
 */
function discoverDotnetTestProjects(): DotnetTestProject[] {
  const projects: DotnetTestProject[] = [];

  function walk(dir: string): void {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (EXCLUDED_DIRS.has(entry.name)) continue;
        // Skip deployment-strategies/ — they are generated copies validated by L7
        const rel = relative(REPO_ROOT, resolve(dir, entry.name));
        if (rel.startsWith('deployment-strategies')) continue;
        // Skip bin/ and obj/ directories (.NET build outputs)
        if (entry.name === 'bin' || entry.name === 'obj') continue;
        walk(resolve(dir, entry.name));
        continue;
      }

      // Look for *.Tests.csproj files
      if (entry.isFile() && entry.name.endsWith('.Tests.csproj')) {
        const fullPath = resolve(dir, entry.name);
        const projectName = entry.name.replace('.csproj', '');
        projects.push({
          name: projectName,
          csprojPath: fullPath,
          dir,
          relativePath: relative(REPO_ROOT, dir)
        });
      }
    }
  }

  walk(REPO_ROOT);
  return projects.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}

// ─── Layer Implementations ──────────────────────────────────────────────

/**
 * Run a single step (lint, typecheck, or test) for a project and return the result.
 * Used by parallel runners to execute steps concurrently.
 */
async function runStep(
  stepName: string,
  cmd: string,
  args: string[],
  cwd: string,
  timeoutMs = 120_000
): Promise<StepResult> {
  const stepStart = Date.now();
  logStep(`${stepName}...`);

  const result = await runCommand(cmd, args, cwd, timeoutMs);
  const passed = result.success;
  const step: StepResult = {
    name: stepName,
    passed,
    durationMs: Date.now() - stepStart,
    output: passed ? undefined : result.stdout.slice(-1000),
    error: passed ? undefined : result.stderr.slice(0, 500)
  };
  logStep(`  ${passed ? 'PASS' : 'FAIL'} ${stepName} (${String(step.durationMs)}ms)`);
  return step;
}

async function runL1(projects: Project[]): Promise<LayerResult> {
  const start = Date.now();

  // Step 1: Repo-level lint + format — run in parallel (independent commands)
  logStep('Repo-level lint + format (parallel)...');
  const [lintStep, formatStep] = await Promise.all([
    runStep('repo-lint', 'npm', ['run', 'lint'], REPO_ROOT),
    runStep('repo-format', 'npm', ['run', 'format'], REPO_ROOT)
  ]);

  // Step 2: Per-project typecheck — run ALL in parallel
  // Note: Per-project lint is intentionally skipped. The root `eslint .` already
  // covers components/, testing/, and scripts/ via eslint.config.mjs. Running
  // `eslint .` inside each sub-project is redundant (it resolves the same root
  // config and re-lints the same files).
  const typecheckProjects = projects.filter(
    (p) => p.hasTypecheck && !p.relativePath.startsWith('deployment-strategies/')
  );

  logStep(`Typecheck: ${String(typecheckProjects.length)} TS projects (parallel)...`);

  // Ensure deps are installed before typechecking (sequential to avoid npm races)
  for (const project of typecheckProjects) {
    if (!existsSync(resolve(project.dir, 'node_modules'))) {
      await runCommand('npm', ['install'], project.dir);
    }
  }

  // Step 3: .NET test projects — `dotnet build` is the C# equivalent of typecheck
  const dotnetProjects = discoverDotnetTestProjects();

  logStep(`Typecheck: ${String(dotnetProjects.length)} .NET projects (parallel)...`);

  // Run TS typechecks and .NET builds in parallel
  const [typecheckSteps, dotnetBuildSteps] = await Promise.all([
    Promise.all(
      typecheckProjects.map((project) =>
        runStep(`typecheck:${project.relativePath}`, 'npm', ['run', 'typecheck'], project.dir)
      )
    ),
    Promise.all(
      dotnetProjects.map((project) =>
        runStep(
          `dotnet-build:${project.relativePath}`,
          'dotnet',
          ['build', project.csprojPath, '--verbosity', 'quiet', '--nologo'],
          project.dir,
          120_000
        )
      )
    )
  ]);

  const steps = [lintStep, formatStep, ...typecheckSteps, ...dotnetBuildSteps];
  const passed = steps.every((s) => s.passed);
  return {
    layer: 'L1',
    description: LAYER_DESCRIPTIONS.L1,
    passed,
    durationMs: Date.now() - start,
    details: steps
  };
}

async function runL2(projects: Project[]): Promise<LayerResult> {
  const start = Date.now();

  // Skip generated deployment-strategy projects — they are generated copies of components/ and are
  // validated by L7 (drift check). Testing identical code twice is waste.
  const testableProjects = projects.filter((p) => p.hasTest && !p.relativePath.startsWith('deployment-strategies/'));

  // Ensure deps are installed before testing (sequential to avoid npm races)
  for (const project of testableProjects) {
    if (!existsSync(resolve(project.dir, 'node_modules'))) {
      await runCommand('npm', ['install'], project.dir);
    }
  }

  // Discover .NET test projects
  const dotnetProjects = discoverDotnetTestProjects();

  logStep(`Test: ${String(testableProjects.length)} TS projects (parallel)...`);
  const tsSteps = await Promise.all(
    testableProjects.map((project) =>
      runStep(`test:${project.relativePath}`, 'npm', ['run', 'test'], project.dir, 180_000)
    )
  );

  // Run .NET tests sequentially to avoid transient port/process contention
  // with each other and with concurrent JavaScript test runners.
  logStep(`Test: ${String(dotnetProjects.length)} .NET projects (sequential)...`);
  const dotnetSteps: StepResult[] = [];
  for (const project of dotnetProjects) {
    dotnetSteps.push(
      await runStep(
        `dotnet-test:${project.relativePath}`,
        'dotnet',
        ['test', project.csprojPath, '--verbosity', 'quiet', '--nologo'],
        project.dir,
        180_000
      )
    );
  }

  const steps = [...tsSteps, ...dotnetSteps];
  const passed = steps.every((s) => s.passed);
  return {
    layer: 'L2',
    description: LAYER_DESCRIPTIONS.L2,
    passed,
    durationMs: Date.now() - start,
    details: steps
  };
}

async function runPlaceholderLayer(layer: LayerName): Promise<LayerResult> {
  return {
    layer,
    description: LAYER_DESCRIPTIONS[layer],
    passed: true,
    durationMs: 0,
    details: [],
    skipped: true,
    skipReason: 'Not yet implemented — requires components from later workstreams'
  };
}

function listDeploymentStrategyInfraDirs(sampleFilter?: string | undefined): string[] {
  return listGeneratedStrategyDirs(DEPLOYMENT_STRATEGIES_ROOT)
    .filter((dir) => {
      if (!sampleFilter) return true;
      const strategyPath = relative(DEPLOYMENT_STRATEGIES_ROOT, dir);
      return strategyPath.includes(sampleFilter) || basename(dir).includes(sampleFilter);
    })
    .map((dir) => resolve(dir, 'infra'));
}

async function runL8(sampleFilter?: string | undefined): Promise<LayerResult> {
  const start = Date.now();
  const steps: StepResult[] = [];

  const fmtTargets = [
    { name: 'fmt:reference-architecture', dir: resolve(REFERENCE_ARCHITECTURES_ROOT, 'foundry_agentic_app') },
    { name: 'fmt:strategy-source', dir: resolve(REPO_ROOT, 'components', 'iac', 'azure-container-apps') },
    { name: 'fmt:module-ref-test', dir: resolve(REPO_ROOT, 'testing', 'caira-module-ref-test') },
    { name: 'fmt:generated-strategies', dir: DEPLOYMENT_STRATEGIES_ROOT }
  ];

  for (const target of fmtTargets) {
    const stepStart = Date.now();
    logStep(`${target.name}...`);
    const result = await runCommand('terraform', ['fmt', '-check', '-recursive', target.dir], REPO_ROOT, 180_000);
    const passed = result.success;
    steps.push({
      name: target.name,
      passed,
      durationMs: Date.now() - stepStart,
      output: passed ? undefined : result.stdout.slice(-1000),
      error: passed ? undefined : result.stderr.slice(-1000)
    });
    logStep(`  ${passed ? 'PASS' : 'FAIL'} ${target.name} (${String(Date.now() - stepStart)}ms)`);

    if (!passed) {
      return {
        layer: 'L8',
        description: LAYER_DESCRIPTIONS.L8,
        passed: false,
        durationMs: Date.now() - start,
        details: steps
      };
    }
  }

  const validateTargets = [
    { name: 'validate:reference-architecture', dir: resolve(REFERENCE_ARCHITECTURES_ROOT, 'foundry_agentic_app') },
    { name: 'validate:strategy-source', dir: resolve(REPO_ROOT, 'components', 'iac', 'azure-container-apps') },
    { name: 'validate:module-ref-test', dir: resolve(REPO_ROOT, 'testing', 'caira-module-ref-test') },
    ...listDeploymentStrategyInfraDirs(sampleFilter).map((dir) => ({
      name: `validate:${basename(resolve(dir, '..'))}`,
      dir
    }))
  ];

  for (const target of validateTargets) {
    const initStart = Date.now();
    logStep(`${target.name}:init...`);
    const initResult = await runCommand('terraform', ['init', '-backend=false', '-input=false'], target.dir, 300_000);
    const initPassed = initResult.success;
    steps.push({
      name: `${target.name}:init`,
      passed: initPassed,
      durationMs: Date.now() - initStart,
      output: initPassed ? undefined : initResult.stdout.slice(-1000),
      error: initPassed ? undefined : initResult.stderr.slice(-1000)
    });
    logStep(`  ${initPassed ? 'PASS' : 'FAIL'} ${target.name}:init (${String(Date.now() - initStart)}ms)`);

    if (!initPassed) {
      return {
        layer: 'L8',
        description: LAYER_DESCRIPTIONS.L8,
        passed: false,
        durationMs: Date.now() - start,
        details: steps
      };
    }

    const validateStart = Date.now();
    logStep(`${target.name}:validate...`);
    const validateResult = await runCommand('terraform', ['validate'], target.dir, 180_000);
    const validatePassed = validateResult.success;
    steps.push({
      name: `${target.name}:validate`,
      passed: validatePassed,
      durationMs: Date.now() - validateStart,
      output: validatePassed ? undefined : validateResult.stdout.slice(-1000),
      error: validatePassed ? undefined : validateResult.stderr.slice(-1000)
    });
    logStep(`  ${validatePassed ? 'PASS' : 'FAIL'} ${target.name}:validate (${String(Date.now() - validateStart)}ms)`);

    if (!validatePassed) {
      return {
        layer: 'L8',
        description: LAYER_DESCRIPTIONS.L8,
        passed: false,
        durationMs: Date.now() - start,
        details: steps
      };
    }
  }

  return {
    layer: 'L8',
    description: LAYER_DESCRIPTIONS.L8,
    passed: true,
    durationMs: Date.now() - start,
    details: steps
  };
}

// ─── Component Discovery ────────────────────────────────────────────────

interface ComponentInfo {
  /** Relative path from repo root (e.g., "components/agent/typescript/foundry-agent-service") */
  relativePath: string;
  /** Absolute path to component directory */
  dir: string;
  /** component.json contents */
  name: string;
  type: string;
  variant?: string | undefined;
  language: string;
  port: number;
  healthEndpoint: string;
  contractSpec?: string | undefined;
  requiredEnv: string[];
  optionalEnv: string[];
  /** Whether a Dockerfile exists in this component */
  hasDockerfile: boolean;
}

/**
 * Discover all components with a component.json under components/.
 */
function discoverComponents(): ComponentInfo[] {
  const componentsDir = resolve(REPO_ROOT, 'components');
  const results: ComponentInfo[] = [];

  function walk(dir: string): void {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (['node_modules', 'dist', 'bin', 'obj'].includes(entry.name)) continue;

      const fullPath = resolve(dir, entry.name);
      const componentJsonPath = resolve(fullPath, 'component.json');

      if (existsSync(componentJsonPath)) {
        try {
          const raw = JSON.parse(readFileSync(componentJsonPath, 'utf-8')) as Record<string, unknown>;
          results.push({
            relativePath: relative(REPO_ROOT, fullPath),
            dir: fullPath,
            name: raw['name'] as string,
            type: raw['type'] as string,
            variant: raw['variant'] as string | undefined,
            language: raw['language'] as string,
            port: raw['port'] as number,
            healthEndpoint: raw['healthEndpoint'] as string,
            contractSpec: raw['contractSpec'] as string | undefined,
            requiredEnv: (raw['requiredEnv'] as string[]) ?? [],
            optionalEnv: (raw['optionalEnv'] as string[]) ?? [],
            hasDockerfile: existsSync(resolve(fullPath, 'Dockerfile'))
          });
        } catch {
          // Invalid component.json — skip
        }
        continue; // Don't descend further
      }

      walk(fullPath);
    }
  }

  walk(componentsDir);
  return results.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}

// ─── L3: Contract Compliance ────────────────────────────────────────────

/**
 * Wait for a health endpoint to respond with HTTP 200.
 * Uses exponential backoff. Returns true if healthy, false if timed out.
 */
async function waitForHealth(url: string, timeoutMs = 30_000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  let delay = 250;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(2000) });
      if (response.ok) return true;
      // Consume body to avoid leaks
      await response.text();
    } catch {
      // Not ready yet
    }
    await new Promise((r) => setTimeout(r, delay));
    delay = Math.min(delay * 2, 3000);
  }
  return false;
}

/**
 * Spawn a process and return it. The caller is responsible for killing it.
 */
function spawnProcess(cmd: string, args: string[], cwd: string, env: Record<string, string>): ChildProcess {
  const child = spawn(cmd, args, {
    cwd,
    env: { ...process.env, ...env, FORCE_COLOR: '0', NO_COLOR: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: false
  });
  return child;
}

/**
 * Kill a child process and wait for it to exit.
 */
async function killProcess(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null) return; // Already exited
  child.kill('SIGTERM');
  await new Promise<void>((resolve) => {
    const timeout = setTimeout(() => {
      child.kill('SIGKILL');
      resolve();
    }, 5000);
    child.on('exit', () => {
      clearTimeout(timeout);
      resolve();
    });
  });
}

/**
 * Build the mock env vars needed to start a component for contract testing.
 */
function buildMockEnv(component: ComponentInfo, mockPort: number): Record<string, string> {
  const env: Record<string, string> = {
    PORT: String(component.port),
    SKIP_AUTH: 'true',
    LOG_LEVEL: 'warn'
  };

  if (component.type === 'agent') {
    // Agent components need a mock AI backend
    const variant = component.variant;
    const mockEntry = variant ? MOCK_MAP[variant] : undefined;
    if (mockEntry) {
      env[mockEntry.endpointEnvVar] = `http://127.0.0.1:${String(mockPort)}`;
    }
  } else if (component.type === 'api') {
    // API components need a mock agent endpoint.
    // We point AGENT_SERVICE_URL at the mock, which won't have agent routes,
    // but we can still validate the API's own contract endpoints (health, etc.)
    // For full API contract testing we'd need a running agent — but the health
    // and basic shape endpoints are still testable.
    env['AGENT_SERVICE_URL'] = `http://127.0.0.1:${String(mockPort)}`;
  }

  return env;
}

/**
 * Path templates to skip per component type during L3 contract validation.
 *
 * Agent endpoints that require a pre-existing conversation ID are skipped —
 * the contract validator generates zeroed UUIDs for path params which won't
 * match any real resource.
 *
 * API endpoints that require pre-existing conversations are similarly skipped.
 */
const L3_SKIP_PATHS: Record<string, string[]> = {
  agent: ['/conversations/{conversationId}', '/conversations/{conversationId}/messages'],
  api: ['/api/activities/conversations/{conversationId}', '/api/activities/conversations/{conversationId}/messages']
};

/**
 * Run contract validation for a single TypeScript component using direct process spawning.
 */
async function runContractForTsComponent(
  component: ComponentInfo,
  mockPort: number,
  extraProcesses?: {
    cmd: string;
    args: string[];
    cwd: string;
    env: Record<string, string>;
    port: number;
    healthEndpoint: string;
  }[]
): Promise<StepResult> {
  const stepStart = Date.now();
  const stepName = `contract:${component.relativePath}`;
  logStep(`${stepName}...`);

  // Ensure deps installed
  if (!existsSync(resolve(component.dir, 'node_modules'))) {
    const installResult = await runCommand('npm', ['install'], component.dir);
    if (!installResult.success) {
      const step: StepResult = {
        name: stepName,
        passed: false,
        durationMs: Date.now() - stepStart,
        error: `npm install failed: ${installResult.stderr.slice(0, 300)}`
      };
      logStep(`  FAIL ${stepName} (${String(step.durationMs)}ms)`);
      return step;
    }
  }

  // Start the component process
  const env = buildMockEnv(component, mockPort);

  // If extra dependency processes exist and this is an API component,
  // override AGENT_SERVICE_URL to point at the agent dependency (not the mock)
  if (extraProcesses && component.type === 'api') {
    const agentDep = extraProcesses.find((p) => p.port === 3000);
    if (agentDep) {
      env['AGENT_SERVICE_URL'] = `http://127.0.0.1:${String(agentDep.port)}`;
    }
  }

  // Start any extra dependency processes first (e.g., agent for API components)
  const extraChildren: ChildProcess[] = [];
  if (extraProcesses) {
    for (const dep of extraProcesses) {
      // Ensure deps installed for dependency
      if (!existsSync(resolve(dep.cwd, 'node_modules'))) {
        await runCommand('npm', ['install'], dep.cwd);
      }
      const depChild = spawnProcess(dep.cmd, dep.args, dep.cwd, dep.env);
      extraChildren.push(depChild);
      const depHealthy = await waitForHealth(`http://127.0.0.1:${String(dep.port)}${dep.healthEndpoint}`, 30_000);
      if (!depHealthy) {
        // Cleanup extra deps only (main component not started yet)
        for (const c of extraChildren) await killProcess(c);
        const step: StepResult = {
          name: stepName,
          passed: false,
          durationMs: Date.now() - stepStart,
          error: `Dependency process failed to become healthy on port ${String(dep.port)}`
        };
        logStep(`  FAIL ${stepName} (${String(step.durationMs)}ms)`);
        return step;
      }
    }
  }

  const child = spawnProcess('node', ['src/server.ts'], component.dir, env);

  try {
    // Wait for health
    const healthUrl = `http://127.0.0.1:${String(component.port)}${component.healthEndpoint}`;
    const healthy = await waitForHealth(healthUrl, 30_000);
    if (!healthy) {
      const step: StepResult = {
        name: stepName,
        passed: false,
        durationMs: Date.now() - stepStart,
        error: `Component failed to become healthy at ${healthUrl} within 30s`
      };
      logStep(`  FAIL ${stepName} (${String(step.durationMs)}ms)`);
      return step;
    }

    // Run contract validator via CLI
    const specPath = resolve(REPO_ROOT, component.contractSpec ?? '');
    const baseUrl = `http://127.0.0.1:${String(component.port)}`;
    const validatorCli = resolve(REPO_ROOT, 'testing', 'contract-validator', 'src', 'cli.ts');

    const skipPaths = L3_SKIP_PATHS[component.type] ?? [];
    const validatorArgs = [validatorCli, '--spec', specPath, '--url', baseUrl, '--no-sse', '--timeout', '10000'];
    if (skipPaths.length > 0) {
      validatorArgs.push('--skip-paths', skipPaths.join(','));
    }

    const result = await runCommand('node', validatorArgs, REPO_ROOT, 60_000);

    const passed = result.success;
    const step: StepResult = {
      name: stepName,
      passed,
      durationMs: Date.now() - stepStart,
      output: passed ? result.stdout.slice(-500) : result.stdout.slice(-1000),
      error: passed ? undefined : result.stderr.slice(0, 500)
    };
    logStep(`  ${passed ? 'PASS' : 'FAIL'} ${stepName} (${String(step.durationMs)}ms)`);
    return step;
  } finally {
    await killProcess(child);
    for (const c of extraChildren) await killProcess(c);
  }
}

/**
 * Run contract validation for a single C# component using Docker.
 *
 * Builds the Docker image, starts a container with mock env vars on a Docker
 * network alongside the ai-mock, runs the contract validator, then cleans up.
 */
async function runContractForDockerComponent(
  component: ComponentInfo,
  mockPort: number,
  agentBaseUrl?: string
): Promise<StepResult> {
  const stepStart = Date.now();
  const stepName = `contract:${component.relativePath}`;
  logStep(`${stepName} (docker)...`);

  const imageTag = `caira-l3-${component.name}-${component.language}-${Date.now()}`;
  const containerName = `caira-l3-${component.name}-${component.language}`;
  const dockerfile = resolve(component.dir, 'Dockerfile');

  try {
    // Build the image
    logStep(`  Building Docker image...`);
    const buildResult = await runCommand(
      'docker',
      ['build', '-f', dockerfile, '-t', imageTag, component.dir],
      REPO_ROOT,
      180_000
    );
    if (!buildResult.success) {
      const step: StepResult = {
        name: stepName,
        passed: false,
        durationMs: Date.now() - stepStart,
        error: `Docker build failed: ${buildResult.stderr.slice(0, 500)}`
      };
      logStep(`  FAIL ${stepName} (${String(step.durationMs)}ms)`);
      return step;
    }

    // Build env args.
    // The container runs on the default Docker bridge network. We discover
    // the IP that sibling containers can use to reach our process (ai-mock),
    // and rewrite mock URLs from 127.0.0.1 to that IP.
    const hostIP = await getHostIPForDocker();
    const env = buildMockEnv(component, mockPort);
    // Rewrite any 127.0.0.1 URLs so the container can reach host services
    for (const [key, value] of Object.entries(env)) {
      if (typeof value === 'string' && value.includes('127.0.0.1')) {
        env[key] = value.replace('127.0.0.1', hostIP);
      }
    }
    // If a running agent URL is provided (for API components), override
    // AGENT_SERVICE_URL to point at it via the host IP so the container can reach it.
    if (agentBaseUrl && component.type === 'api') {
      env['AGENT_SERVICE_URL'] = agentBaseUrl.replace('127.0.0.1', hostIP);
    }
    // Use random host port mapping so health/contract validation works even when
    // bridge-network container IPs are not directly reachable from the host.
    const runArgs: string[] = ['run', '-d', '--rm', '--name', containerName, '-p', String(component.port)];
    for (const [key, value] of Object.entries(env)) {
      runArgs.push('-e', `${key}=${value}`);
    }
    runArgs.push(imageTag);

    logStep(`  Starting container...`);
    const runResult = await runCommand('docker', runArgs, REPO_ROOT, 30_000);
    if (!runResult.success) {
      // Cleanup image
      await runCommand('docker', ['rmi', '-f', imageTag], REPO_ROOT, 10_000);
      const step: StepResult = {
        name: stepName,
        passed: false,
        durationMs: Date.now() - stepStart,
        error: `Docker run failed: ${runResult.stderr.slice(0, 500)}`
      };
      logStep(`  FAIL ${stepName} (${String(step.durationMs)}ms)`);
      return step;
    }

    const containerId = runResult.stdout.trim();

    try {
      // Prefer host-mapped port for reachability from this process.
      let healthBaseUrl: string | null = null;
      const portResult = await runCommand('docker', ['port', containerId, String(component.port)], REPO_ROOT, 5_000);
      const hostPortMatch = portResult.stdout.match(/:(\d+)$/m);
      const hostPort = hostPortMatch?.[1];
      if (hostPort) {
        healthBaseUrl = `http://127.0.0.1:${hostPort}`;
      } else {
        const containerIP = await discoverContainerIP(containerId);
        if (containerIP) {
          healthBaseUrl = `http://${containerIP}:${String(component.port)}`;
        }
      }
      if (!healthBaseUrl) {
        const step: StepResult = {
          name: stepName,
          passed: false,
          durationMs: Date.now() - stepStart,
          error: 'Could not determine a reachable URL for container health checks'
        };
        logStep(`  FAIL ${stepName} (${String(step.durationMs)}ms)`);
        return step;
      }

      // Wait for health
      const healthUrl = `${healthBaseUrl}${component.healthEndpoint}`;
      const healthy = await waitForHealth(healthUrl, 60_000);
      if (!healthy) {
        const step: StepResult = {
          name: stepName,
          passed: false,
          durationMs: Date.now() - stepStart,
          error: `Container failed to become healthy at ${healthUrl} within 60s`
        };
        logStep(`  FAIL ${stepName} (${String(step.durationMs)}ms)`);
        return step;
      }

      // Run contract validator against the same reachable base URL used for health checks.
      const specPath = resolve(REPO_ROOT, component.contractSpec ?? '');
      const baseUrl = healthBaseUrl;
      const validatorCli = resolve(REPO_ROOT, 'testing', 'contract-validator', 'src', 'cli.ts');

      const skipPaths = L3_SKIP_PATHS[component.type] ?? [];
      const validatorArgs = [validatorCli, '--spec', specPath, '--url', baseUrl, '--no-sse', '--timeout', '10000'];
      if (skipPaths.length > 0) {
        validatorArgs.push('--skip-paths', skipPaths.join(','));
      }

      const result = await runCommand('node', validatorArgs, REPO_ROOT, 60_000);

      const passed = result.success;
      const step: StepResult = {
        name: stepName,
        passed,
        durationMs: Date.now() - stepStart,
        output: passed ? result.stdout.slice(-500) : result.stdout.slice(-1000),
        error: passed ? undefined : result.stderr.slice(0, 500)
      };
      logStep(`  ${passed ? 'PASS' : 'FAIL'} ${stepName} (${String(step.durationMs)}ms)`);
      return step;
    } finally {
      // Cleanup: stop container + remove image
      await runCommand('docker', ['rm', '-f', containerId], REPO_ROOT, 10_000);
      await runCommand('docker', ['rmi', '-f', imageTag], REPO_ROOT, 10_000);
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    // Best-effort cleanup
    await runCommand('docker', ['rm', '-f', containerName], REPO_ROOT, 10_000);
    await runCommand('docker', ['rmi', '-f', imageTag], REPO_ROOT, 10_000);
    const step: StepResult = {
      name: stepName,
      passed: false,
      durationMs: Date.now() - stepStart,
      error: `Unexpected error: ${msg}`
    };
    logStep(`  FAIL ${stepName} (${String(step.durationMs)}ms)`);
    return step;
  }
}

/**
 * L3: Contract Compliance — start each component with mock backends and
 * validate against its OpenAPI spec.
 *
 * TypeScript components: started directly via node (fast, no Docker).
 * C# components: built and run via Docker (no .NET SDK needed on host).
 */
async function runL3(): Promise<LayerResult> {
  const start = Date.now();
  const steps: StepResult[] = [];

  // Discover components that have a contract spec.
  // Exclude frontend — it serves static files and proxies to the API; it doesn't
  // implement a standalone REST API contract that the validator can test.
  const components = discoverComponents().filter((c) => c.contractSpec && c.type !== 'frontend' && c.type !== 'iac');

  if (components.length === 0) {
    return {
      layer: 'L3',
      description: LAYER_DESCRIPTIONS.L3,
      passed: true,
      durationMs: 0,
      details: [],
      skipped: true,
      skipReason: 'No components with contractSpec found'
    };
  }

  // Check if Docker components exist and Docker is needed
  const dockerComponents = components.filter((c) => c.language !== 'typescript');
  const needsDocker = dockerComponents.length > 0;
  const dockerStatus = needsDocker ? await getDockerOperationalStatus() : { ok: false };
  if (needsDocker && !dockerStatus.ok) {
    // Can still run TS components — just skip Docker ones
    logStep(`${dockerStatus.reason ?? 'Docker not operational'} — C# components will be skipped in L3`);
  }
  const isDockerAvailable = needsDocker ? dockerStatus.ok : false;

  // Start the ai-mock server — needed by all agent and API components
  const mockDir = resolve(REPO_ROOT, 'testing', 'mocks', 'ai-mock');
  if (!existsSync(resolve(mockDir, 'node_modules'))) {
    await runCommand('npm', ['install'], mockDir);
  }
  const mockPort = 8100;
  logStep('Starting ai-mock server...');
  const mockProcess = spawnProcess('node', ['src/server.ts'], mockDir, {
    PORT: String(mockPort),
    HOST: '0.0.0.0'
  });

  try {
    // Wait for mock to be healthy
    const mockHealthy = await waitForHealth(`http://127.0.0.1:${String(mockPort)}/health`, 15_000);
    if (!mockHealthy) {
      steps.push({
        name: 'ai-mock-startup',
        passed: false,
        durationMs: Date.now() - start,
        error: 'ai-mock failed to start within 15s'
      });
      return {
        layer: 'L3',
        description: LAYER_DESCRIPTIONS.L3,
        passed: false,
        durationMs: Date.now() - start,
        details: steps
      };
    }
    logStep('  ai-mock healthy');

    // Run components sequentially to avoid port conflicts.
    // API components need a running agent as a dependency — the API proxies
    // requests to the agent. We start a TS agent (foundry-agent-service) as
    // the dependency for TS API components.
    const agentDir = resolve(REPO_ROOT, 'components', 'agent', 'typescript', 'foundry-agent-service');
    const agentPort = 3000;

    for (const component of components) {
      // Build extra dependency processes for API components
      let extraProcesses:
        | {
            cmd: string;
            args: string[];
            cwd: string;
            env: Record<string, string>;
            port: number;
            healthEndpoint: string;
          }[]
        | undefined;

      if (component.type === 'api' && component.language === 'typescript') {
        // API needs a running agent → start foundry-agent-service on port 3000
        const agentEnv = buildMockEnv(
          {
            type: 'agent',
            variant: 'foundry-agent-service',
            port: agentPort
          } as ComponentInfo,
          mockPort
        );
        extraProcesses = [
          {
            cmd: 'node',
            args: ['src/server.ts'],
            cwd: agentDir,
            env: { ...agentEnv, SKIP_AUTH: 'true' },
            port: agentPort,
            healthEndpoint: '/health'
          }
        ];
      }

      if (component.language === 'typescript') {
        const step = await runContractForTsComponent(component, mockPort, extraProcesses);
        steps.push(step);
      } else if (isDockerAvailable && component.hasDockerfile) {
        // For C# API components, start a TS agent as a dependency — the API
        // proxies requests to the agent, so it needs a live one to respond.
        let agentDepChild: ChildProcess | undefined;
        let agentBaseUrl: string | undefined;
        if (component.type === 'api') {
          // Install deps if needed
          if (!existsSync(resolve(agentDir, 'node_modules'))) {
            await runCommand('npm', ['install'], agentDir);
          }
          const agentEnv = buildMockEnv(
            {
              type: 'agent',
              variant: 'foundry-agent-service',
              port: agentPort
            } as ComponentInfo,
            mockPort
          );
          agentDepChild = spawnProcess('node', ['src/server.ts'], agentDir, {
            ...agentEnv,
            SKIP_AUTH: 'true'
          });
          const agentHealthy = await waitForHealth(`http://127.0.0.1:${String(agentPort)}/health`, 30_000);
          if (!agentHealthy) {
            await killProcess(agentDepChild);
            steps.push({
              name: `contract:${component.relativePath}`,
              passed: false,
              durationMs: Date.now() - start,
              error: 'Agent dependency failed to start for C# API contract validation'
            });
            continue;
          }
          agentBaseUrl = `http://127.0.0.1:${String(agentPort)}`;
        }

        try {
          const step = await runContractForDockerComponent(component, mockPort, agentBaseUrl);
          steps.push(step);
        } finally {
          if (agentDepChild) await killProcess(agentDepChild);
        }
      } else {
        steps.push({
          name: `contract:${component.relativePath}`,
          passed: true,
          durationMs: 0,
          output: `Skipped: ${component.language} component requires Docker`
        });
        logStep(`  SKIP contract:${component.relativePath} (${component.language} — Docker not available)`);
      }
    }
  } finally {
    await killProcess(mockProcess);
  }

  const passed = steps.every((s) => s.passed);
  return {
    layer: 'L3',
    description: LAYER_DESCRIPTIONS.L3,
    passed,
    durationMs: Date.now() - start,
    details: steps
  };
}

// ─── L4: Container Builds ───────────────────────────────────────────────

/**
 * L4: Container Builds — build each component's Dockerfile, start a container,
 * and validate the health endpoint responds.
 *
 * Uses the container-health validator tool via its CLI.
 */
async function runL4(): Promise<LayerResult> {
  const start = Date.now();
  const steps: StepResult[] = [];

  // Check Docker availability and operability
  const dockerStatus = await getDockerOperationalStatus();
  if (!dockerStatus.ok) {
    return {
      layer: 'L4',
      description: LAYER_DESCRIPTIONS.L4,
      passed: true,
      durationMs: 0,
      details: [],
      skipped: true,
      skipReason: dockerStatus.reason ?? 'Docker is not available'
    };
  }

  // Discover all components with Dockerfiles
  const components = discoverComponents().filter((c) => c.hasDockerfile);

  // Also include azcred (no component.json but has Dockerfile)
  const azcredDir = resolve(REPO_ROOT, 'components', 'azcred', 'typescript');
  const hasAzcredDockerfile = existsSync(resolve(azcredDir, 'Dockerfile'));

  interface ContainerTarget {
    name: string;
    dockerfile: string;
    context: string;
    healthEndpoint: string;
    port: number;
    env: Record<string, string>;
  }

  const targets: ContainerTarget[] = components.map((c) => ({
    name: c.relativePath,
    dockerfile: resolve(c.dir, 'Dockerfile'),
    context: c.dir,
    healthEndpoint: c.healthEndpoint,
    port: c.port,
    env: buildContainerEnv(c)
  }));

  if (hasAzcredDockerfile) {
    targets.push({
      name: 'components/azcred/typescript',
      dockerfile: resolve(azcredDir, 'Dockerfile'),
      context: azcredDir,
      healthEndpoint: '/health',
      port: 8079,
      env: {}
    });
  }

  if (targets.length === 0) {
    return {
      layer: 'L4',
      description: LAYER_DESCRIPTIONS.L4,
      passed: true,
      durationMs: 0,
      details: [],
      skipped: true,
      skipReason: 'No components with Dockerfiles found'
    };
  }

  logStep(`Container builds: ${String(targets.length)} targets`);

  // API containers need a running agent to pass health checks (they do a
  // deep health check that proxies to AGENT_SERVICE_URL/health). Start the
  // ai-mock + a TS agent process for them.
  const hasApiTargets = components.some((c) => c.type === 'api');
  let mockProcess: ChildProcess | undefined;
  let agentProcess: ChildProcess | undefined;
  let agentUrlForDocker: string | undefined;

  if (hasApiTargets) {
    const mockDir = resolve(REPO_ROOT, 'testing', 'mocks', 'ai-mock');
    if (!existsSync(resolve(mockDir, 'node_modules'))) {
      await runCommand('npm', ['install'], mockDir);
    }
    const mockPort = 8100;
    logStep('  Starting ai-mock for API container health checks...');
    mockProcess = spawnProcess('node', ['src/server.ts'], mockDir, {
      PORT: String(mockPort),
      HOST: '0.0.0.0'
    });
    const mockHealthy = await waitForHealth(`http://127.0.0.1:${String(mockPort)}/health`, 15_000);
    if (!mockHealthy) {
      await killProcess(mockProcess);
      return {
        layer: 'L4',
        description: LAYER_DESCRIPTIONS.L4,
        passed: false,
        durationMs: Date.now() - start,
        details: [
          {
            name: 'ai-mock-startup',
            passed: false,
            durationMs: Date.now() - start,
            error: 'ai-mock failed to start within 15s (needed for API health checks)'
          }
        ]
      };
    }

    // Start a TS agent for the API to reach
    const agentDir = resolve(REPO_ROOT, 'components', 'agent', 'typescript', 'foundry-agent-service');
    if (!existsSync(resolve(agentDir, 'node_modules'))) {
      await runCommand('npm', ['install'], agentDir);
    }
    const agentPort = 3000;
    const agentEnv = buildMockEnv(
      { type: 'agent', variant: 'foundry-agent-service', port: agentPort } as ComponentInfo,
      mockPort
    );
    agentProcess = spawnProcess('node', ['src/server.ts'], agentDir, {
      ...agentEnv,
      SKIP_AUTH: 'true'
    });
    const agentHealthy = await waitForHealth(`http://127.0.0.1:${String(agentPort)}/health`, 30_000);
    if (!agentHealthy) {
      await killProcess(agentProcess);
      await killProcess(mockProcess);
      return {
        layer: 'L4',
        description: LAYER_DESCRIPTIONS.L4,
        passed: false,
        durationMs: Date.now() - start,
        details: [
          {
            name: 'agent-dependency-startup',
            passed: false,
            durationMs: Date.now() - start,
            error: 'Agent dependency failed to start (needed for API health checks)'
          }
        ]
      };
    }

    // Discover host IP so Docker containers can reach the agent
    const hostIP = await getHostIPForDocker();
    agentUrlForDocker = `http://${hostIP}:${String(agentPort)}`;
    logStep(`  Agent dependency ready at ${agentUrlForDocker}`);
  }

  try {
    // Validate each container sequentially (avoid resource contention)
    const validatorCli = resolve(REPO_ROOT, 'testing', 'container-health', 'src', 'cli.ts');

    for (const target of targets) {
      const stepStart = Date.now();
      const stepName = `container:${target.name}`;
      logStep(`${stepName}...`);

      const args = [
        validatorCli,
        '--dockerfile',
        target.dockerfile,
        '--health',
        target.healthEndpoint,
        '--container-port',
        String(target.port),
        '--timeout',
        '90000',
        '--context',
        target.context
      ];

      // Pass env vars via --env-file is not available for ad-hoc env,
      // so we set them as process env that the CLI forwards to Docker.
      // Actually, the container-health CLI doesn't forward process env to the container.
      // Instead, we'll call the CLI and let it handle the container.
      // For components that need env vars to start, we need a different approach.
      // The CLI supports --env-file but we don't have one for all components.
      // We'll use the API directly isn't possible (cross-rootDir).
      //
      // Best approach: create a temp env file for each target.

      // For API containers, override AGENT_SERVICE_URL to point at the live
      // agent dependency (reachable via Docker host IP, not localhost).
      if (agentUrlForDocker && target.env['AGENT_SERVICE_URL']) {
        target.env['AGENT_SERVICE_URL'] = agentUrlForDocker;
      }

      const envEntries = Object.entries(target.env);
      let envFilePath: string | undefined;
      let envFileDir: string | undefined;
      if (envEntries.length > 0) {
        envFileDir = mkdtempSync(resolve(tmpdir(), `caira-l4-${basename(target.name)}-`));
        envFilePath = resolve(envFileDir, 'container.env');
        const envContent = envEntries.map(([k, v]) => `${k}=${v}`).join('\n');
        writeFileSync(envFilePath, envContent);
        args.push('--env-file', envFilePath);
      }

      const result = await runCommand('node', args, REPO_ROOT, 180_000);

      // Clean up temp env file
      if (envFilePath) {
        try {
          unlinkSync(envFilePath);
          if (envFileDir) rmSync(envFileDir, { recursive: true, force: true });
        } catch {
          // Best effort
        }
      }

      const passed = result.success;
      steps.push({
        name: stepName,
        passed,
        durationMs: Date.now() - stepStart,
        output: passed ? result.stdout.slice(-500) : result.stdout.slice(-1000),
        error: passed ? undefined : result.stderr.slice(0, 500)
      });
      logStep(`  ${passed ? 'PASS' : 'FAIL'} ${stepName} (${String(Date.now() - stepStart)}ms)`);
    }
  } finally {
    // Clean up agent + mock dependency processes
    if (agentProcess) await killProcess(agentProcess);
    if (mockProcess) await killProcess(mockProcess);
  }

  const passed = steps.every((s) => s.passed);
  return {
    layer: 'L4',
    description: LAYER_DESCRIPTIONS.L4,
    passed,
    durationMs: Date.now() - start,
    details: steps
  };
}

/**
 * Build minimal env vars for a container health check.
 * These env vars make the container start without real external services.
 */
function buildContainerEnv(component: ComponentInfo): Record<string, string> {
  const env: Record<string, string> = {
    SKIP_AUTH: 'true',
    LOG_LEVEL: 'warn'
  };

  // Provide dummy values for required env vars so the container starts
  if (component.type === 'agent') {
    const variant = component.variant;
    const mockEntry = variant ? MOCK_MAP[variant] : undefined;
    if (mockEntry) {
      // Point at a fake URL — container just needs to start and respond to /health
      env[mockEntry.endpointEnvVar] = 'http://localhost:9999';
    }
  } else if (component.type === 'api') {
    env['AGENT_SERVICE_URL'] = 'http://localhost:9999';
  } else if (component.type === 'frontend') {
    env['API_BASE_URL'] = 'http://localhost:9999';
  }

  return env;
}

/**
 * L5: E2E Mock — full-stack compose tests with mock services.
 *
 * Starts compose stack with mock overlay (no Azure needed), then runs
 * compose-e2e.test.ts through the full chain: BFF → API → Agent → Mock.
 * Tests run in mock mode (E2E_MOCK_MODE=true) for deterministic assertions.
 */
async function runL5(sampleFilter?: string | undefined): Promise<LayerResult> {
  const start = Date.now();
  const steps: StepResult[] = [];

  const sampleDirs = listGeneratedStrategyDirs(DEPLOYMENT_STRATEGIES_ROOT).filter((dir) => {
    if (!sampleFilter) return true;
    const strategyPath = relative(DEPLOYMENT_STRATEGIES_ROOT, dir);
    return strategyPath.includes(sampleFilter) || basename(dir).includes(sampleFilter);
  });

  if (sampleDirs.length === 0) {
    return {
      layer: 'L5',
      description: LAYER_DESCRIPTIONS.L5,
      passed: true,
      durationMs: 0,
      details: [],
      skipped: true,
      skipReason: sampleFilter
        ? `No strategy matching "${sampleFilter}" found`
        : 'No deployment strategy directories with docker-compose.yml found'
    };
  }

  // Check Docker availability and operability
  const dockerStatus = await getDockerOperationalStatus();
  if (!dockerStatus.ok) {
    return {
      layer: 'L5',
      description: LAYER_DESCRIPTIONS.L5,
      passed: true,
      durationMs: 0,
      details: [],
      skipped: true,
      skipReason: dockerStatus.reason ?? 'Docker is not available'
    };
  }

  for (const sampleDir of sampleDirs) {
    const sampleName = relative(DEPLOYMENT_STRATEGIES_ROOT, sampleDir);
    const stepStart = Date.now();
    logStep(`Compose E2E: ${sampleName}...`);

    const result = await runComposeTests({
      strategyDir: sampleDir,
      healthTimeoutMs: 90_000
    });

    const passed = result.passed;
    steps.push({
      name: `compose:${sampleName}`,
      passed,
      durationMs: Date.now() - stepStart,
      output: passed ? undefined : result.testOutput?.slice(-1000),
      error: passed ? undefined : (result.error ?? result.containerLogs?.slice(-500))
    });

    logStep(`  ${passed ? 'PASS' : 'FAIL'} compose:${sampleName} (${String(Date.now() - stepStart)}ms)`);
  }

  const passed = steps.every((s) => s.passed);
  return {
    layer: 'L5',
    description: LAYER_DESCRIPTIONS.L5,
    passed,
    durationMs: Date.now() - start,
    details: steps
  };
}

/**
 * L6: E2E Local + Azure — full-stack compose tests with real Azure AI Foundry.
 *
 * Starts compose stack WITHOUT mock overlay, so the agent calls real Azure
 * AI Foundry endpoints. Requires `az login`. Tests run without mock mode —
 * they validate response shapes but not deterministic content.
 *
 * Before running compose, this layer:
 *   1. Calls `ensureDeploy()` to ensure Azure infra exists and write .env files
 *   2. Injects Azure CLI credentials into the Docker `azurecli` volume
 */
async function runL6(sampleFilter?: string | undefined): Promise<LayerResult> {
  const start = Date.now();
  const steps: StepResult[] = [];

  const sampleDirs = listGeneratedStrategyDirs(DEPLOYMENT_STRATEGIES_ROOT).filter((dir) => {
    if (!sampleFilter) return true;
    const strategyPath = relative(DEPLOYMENT_STRATEGIES_ROOT, dir);
    return strategyPath.includes(sampleFilter) || basename(dir).includes(sampleFilter);
  });

  if (sampleDirs.length === 0) {
    return {
      layer: 'L6',
      description: LAYER_DESCRIPTIONS.L6,
      passed: true,
      durationMs: 0,
      details: [],
      skipped: true,
      skipReason: sampleFilter
        ? `No strategy matching "${sampleFilter}" found`
        : 'No deployment strategy directories with docker-compose.yml found'
    };
  }

  // Check Docker availability and operability
  const dockerStatus = await getDockerOperationalStatus();
  if (!dockerStatus.ok) {
    return {
      layer: 'L6',
      description: LAYER_DESCRIPTIONS.L6,
      passed: true,
      durationMs: 0,
      details: [],
      skipped: true,
      skipReason: dockerStatus.reason ?? 'Docker is not available'
    };
  }

  // Step 1: Ensure Azure infrastructure is deployed and .env files are written.
  // ensureDeploy() is idempotent — if Terraform state already has valid outputs,
  // it skips the apply and just writes .env files.
  logStep('Ensuring Azure deployment + writing .env files...');
  try {
    const deployResult = await ensureDeploy();
    logStep(
      `  Azure deploy: ${deployResult.deployed ? 'applied' : 'reused existing'} — ${deployResult.outputs.ai_foundry_name}`
    );
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    steps.push({
      name: 'azure-deploy',
      passed: false,
      durationMs: Date.now() - start,
      error: `Azure deployment failed: ${errorMsg}`
    });
    return {
      layer: 'L6',
      description: LAYER_DESCRIPTIONS.L6,
      passed: false,
      durationMs: Date.now() - start,
      details: steps
    };
  }

  // Step 2: Inject Azure CLI credentials into the Docker volume so the
  // azcred sidecar can authenticate with Azure.
  logStep('Injecting Azure CLI credentials into Docker volume...');
  try {
    await execFileAsync('node', [resolve(REPO_ROOT, 'scripts', 'azure-login.ts'), '--inject'], {
      timeout: 30_000,
      maxBuffer: 1024 * 1024
    });
    logStep('  Azure credentials injected.');
  } catch {
    // --inject may fail if the validation inside the container fails
    // (known issue — creds are valid but the validation mounts at wrong path).
    // Ensure the volume exists and fix permissions as a fallback.
    logStep('  Credential injection reported an error — ensuring volume and permissions...');
    await ensureAzurecliVolume();
    await fixAzurecliPermissions();
  }

  for (const sampleDir of sampleDirs) {
    const sampleName = relative(DEPLOYMENT_STRATEGIES_ROOT, sampleDir);
    const stepStart = Date.now();
    logStep(`E2E (Azure): ${sampleName}...`);

    const result = await runComposeTests({
      strategyDir: sampleDir,
      healthTimeoutMs: 120_000,
      mockMode: false
    });

    const passed = result.passed;
    steps.push({
      name: `e2e-azure:${sampleName}`,
      passed,
      durationMs: Date.now() - stepStart,
      output: passed ? undefined : result.testOutput?.slice(-1000),
      error: passed ? undefined : (result.error ?? result.containerLogs?.slice(-500))
    });

    logStep(`  ${passed ? 'PASS' : 'FAIL'} e2e-azure:${sampleName} (${String(Date.now() - stepStart)}ms)`);
  }

  const passed = steps.every((s) => s.passed);
  return {
    layer: 'L6',
    description: LAYER_DESCRIPTIONS.L6,
    passed,
    durationMs: Date.now() - start,
    details: steps
  };
}

/**
 * L7: Generator Validation — run the drift validator to ensure deployment-strategies/
 * matches what the generator would produce.
 *
 * This catches hand-edits to generated files and stale output from
 * outdated component code.
 */
async function runL7(): Promise<LayerResult> {
  const start = Date.now();
  const steps: StepResult[] = [];

  logStep('Running drift validator...');

  const stepStart = Date.now();
  try {
    const result = await validateSamples(REPO_ROOT);

    if (result.ok) {
      steps.push({
        name: 'drift-check',
        passed: true,
        durationMs: Date.now() - stepStart
      });
      logStep('  PASS drift-check — deployment-strategies/ matches generated output');
    } else {
      const details = result.diffs.map((d) => `${d.kind}: ${d.file}`).join('\n');
      steps.push({
        name: 'drift-check',
        passed: false,
        durationMs: Date.now() - stepStart,
        error: `${result.diffs.length} difference(s) found:\n${details}`
      });
      logStep(`  FAIL drift-check — ${result.diffs.length} difference(s)`);
      for (const diff of result.diffs) {
        logStep(`    ${diff.kind.toUpperCase()}: ${diff.file}`);
      }
    }
  } catch (err) {
    steps.push({
      name: 'drift-check',
      passed: false,
      durationMs: Date.now() - stepStart,
      error: err instanceof Error ? err.message : String(err)
    });
    logStep(`  FAIL drift-check — ${err instanceof Error ? err.message : String(err)}`);
  }

  const passed = steps.every((s) => s.passed);
  return {
    layer: 'L7',
    description: LAYER_DESCRIPTIONS.L7,
    passed,
    durationMs: Date.now() - start,
    details: steps
  };
}

// ─── Main Runner ────────────────────────────────────────────────────────

async function runLayers(options: RunOptions): Promise<LayerResult[]> {
  const projects = discoverProjects();
  const dotnetProjects = discoverDotnetTestProjects();

  log(`Discovered ${String(projects.length)} TS projects:`);
  for (const p of projects) {
    log(
      `  ${p.relativePath} (test:${String(p.hasTest)} lint:${String(p.hasLint)} typecheck:${String(p.hasTypecheck)})`
    );
  }
  if (dotnetProjects.length > 0) {
    log(`Discovered ${String(dotnetProjects.length)} .NET test projects:`);
    for (const p of dotnetProjects) {
      log(`  ${p.relativePath} (${p.name})`);
    }
  }
  log('');

  // ── Pre-flight: regenerate deployment-strategies only when needed ──────
  // L1/L2 no longer test deployment-strategies (root eslint covers lint, L7 validates drift).
  // Only regenerate when running layers that actually need deployment-strategies (L5, L6, L7).
  const SAMPLE_LAYERS: LayerName[] = ['L5', 'L6', 'L7', 'L8'];
  const needsSamples = options.layers.some((l) => SAMPLE_LAYERS.includes(l));

  if (needsSamples) {
    log('Pre-flight: Regenerating deployment-strategies...');
    const regenStart = Date.now();
    try {
      const result = await generate({
        repoRoot: REPO_ROOT,
        samplesDir: DEPLOYMENT_STRATEGIES_ROOT,
        clean: true
      });
      const regenMs = Date.now() - regenStart;
      log(`  Regenerated ${String(result.details.length)} deployment strategy(ies) in ${(regenMs / 1000).toFixed(1)}s`);
    } catch (err) {
      const regenMs = Date.now() - regenStart;
      log(`  FAIL: Deployment strategy regeneration failed in ${(regenMs / 1000).toFixed(1)}s`);
      log(`    ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    }
    log('');
  } else {
    log('Pre-flight: Skipping deployment strategy regeneration (not needed for selected layers)');
    log('');
  }

  const results: LayerResult[] = [];

  for (const layer of options.layers) {
    log(`${'─'.repeat(60)}`);
    log(`Layer ${layer}: ${LAYER_DESCRIPTIONS[layer]}`);
    log(`${'─'.repeat(60)}`);

    // Azure login guard for layers that need it
    if (AZURE_REQUIRED_LAYERS.includes(layer)) {
      const loggedIn = await isAzureLoggedIn();
      if (!loggedIn) {
        const result: LayerResult = {
          layer,
          description: LAYER_DESCRIPTIONS[layer],
          passed: true,
          durationMs: 0,
          details: [],
          skipped: true,
          skipReason: 'Azure CLI not logged in (run `az login`)'
        };
        results.push(result);
        log(`  SKIP: ${result.skipReason}\n`);
        continue;
      }
    }

    let result: LayerResult;

    switch (layer) {
      case 'L1':
        result = await runL1(projects);
        break;
      case 'L2':
        result = await runL2(projects);
        break;
      case 'L3':
        result = await runL3();
        break;
      case 'L4':
        result = await runL4();
        break;
      case 'L5':
        result = await runL5(options.strategy);
        break;
      case 'L6':
        result = await runL6(options.strategy);
        break;
      case 'L7':
        result = await runL7();
        break;
      case 'L8':
        result = await runL8(options.strategy);
        break;
      default:
        result = await runPlaceholderLayer(layer);
    }

    results.push(result);

    if (result.skipped) {
      log(`  SKIP: ${result.skipReason ?? 'Not implemented'}\n`);
    } else {
      log(`  Result: ${result.passed ? 'PASSED' : 'FAILED'} (${(result.durationMs / 1000).toFixed(1)}s)\n`);
    }

    // Stop at first failure unless --continue-on-error
    if (!result.passed && !result.skipped && !options.continueOnError) {
      log(`Stopping at ${layer} due to failure.`);
      break;
    }
  }

  return results;
}

// ─── Summary ────────────────────────────────────────────────────────────

function printSummary(results: LayerResult[]): void {
  log('');
  log('═'.repeat(60));
  log('  Test Run Summary');
  log('═'.repeat(60));
  log('');
  log(`  ${'Layer'.padEnd(6)} ${'Description'.padEnd(25)} ${'Status'.padEnd(10)} Duration`);
  log(`  ${'─'.repeat(6)} ${'─'.repeat(25)} ${'─'.repeat(10)} ${'─'.repeat(10)}`);

  for (const result of results) {
    let status: string;
    if (result.skipped) {
      status = 'SKIP';
    } else if (result.passed) {
      status = 'PASS';
    } else {
      status = 'FAIL';
    }

    const duration = result.skipped ? '-' : `${(result.durationMs / 1000).toFixed(1)}s`;
    log(`  ${result.layer.padEnd(6)} ${result.description.padEnd(25)} ${status.padEnd(10)} ${duration}`);
  }

  const totalDuration = results.reduce((sum, r) => sum + r.durationMs, 0);
  const allPassed = results.every((r) => r.passed || r.skipped);

  log('');
  log(`  Total: ${(totalDuration / 1000).toFixed(1)}s`);
  log(`  Result: ${allPassed ? 'ALL PASSED' : 'FAILED'}`);
  log('');
  log('═'.repeat(60));

  // Print failure details
  const failures = results.filter((r) => !r.passed && !r.skipped);
  if (failures.length > 0) {
    log('');
    log('Failure Details:');
    for (const result of failures) {
      const failedSteps = result.details.filter((s) => !s.passed);
      for (const step of failedSteps) {
        log(`  ${result.layer} > ${step.name}:`);
        if (step.error) {
          log(`    ${step.error.split('\n').join('\n    ')}`);
        }
      }
    }
  }
}

// ─── CLI ────────────────────────────────────────────────────────────────

function printUsage(): void {
  process.stdout.write(`
Master Test Runner — run validation layers across all projects

Usage:
  node scripts/test-all.ts [options]

Options:
  --layer <L1,L2,...>    Run specific layers (comma-separated, default: all except L6)
  --include-azure        Include L6 (Azure E2E) — requires \`az login\` + deployed infra
  --strategy <name>      Run only for a specific deployment strategy
  --continue-on-error    Continue running layers even if one fails
  --help                 Show this help message

Layers:
  L1  Lint & Typecheck         Repo-level + per-project lint and typecheck
  L2  Unit Tests               Per-project \`npm test\` + \`dotnet test\`
  L3  Contract Compliance      Start components + validate against OpenAPI specs
  L4  Container Builds         Build Docker images + health check
  L5  E2E Mock (Compose)       Full-stack E2E with mock services (no Azure needed)
  L6  E2E Local + Azure        Full-stack E2E with real Azure AI Foundry (needs \`az login\`)
  L7  Generator Validation     generate --dry-run + drift check
  L8  Terraform Validation     terraform fmt -check && validate

Scripts:
  node scripts/test-all.ts --layer L1,L2,L3
  npm run test:full            All local layers (L1-L5, L7, L8 — no Azure)
  npm run test:full:azure      Everything including L6 (Azure E2E)

Examples:
  # Run L1 and L2 (fast, agent inner loop)
  node scripts/test-all.ts --layer L1,L2

  # Run all local layers (default)
  node scripts/test-all.ts

  # Run everything including Azure E2E
  node scripts/test-all.ts --include-azure
`);
}

function parseArgs(args: string[]): RunOptions | null {
  let layers: LayerName[] | null = null;
  let strategy: string | undefined;
  let continueOnError = false;
  let includeAzure = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i] ?? '';
    switch (arg) {
      case '--layer': {
        const layerArg = args[++i];
        if (!layerArg) {
          process.stderr.write('ERROR: --layer requires a value\n');
          return null;
        }
        layers = layerArg.split(',').map((l) => l.trim().toUpperCase() as LayerName);
        // Validate
        for (const l of layers) {
          if (!ALL_LAYERS.includes(l)) {
            process.stderr.write(`ERROR: Unknown layer: ${l}\n`);
            return null;
          }
        }
        break;
      }
      case '--include-azure':
        includeAzure = true;
        break;
      case '--strategy':
        strategy = args[++i];
        break;
      case '--continue-on-error':
        continueOnError = true;
        break;
      case '--help':
        printUsage();
        process.exit(0);
        break;
      default:
        process.stderr.write(`ERROR: Unknown option: ${arg}\n`);
        printUsage();
        return null;
    }
  }

  // If --layer was explicitly set, use that. Otherwise, use defaults.
  if (!layers) {
    layers = includeAzure ? [...ALL_LAYERS] : [...DEFAULT_LAYERS];
  } else if (includeAzure && !layers.includes('L6')) {
    // --layer was set but --include-azure was also passed — add L6 in order
    const withAzure: LayerName[] = [];
    for (const l of ALL_LAYERS) {
      if (layers.includes(l) || l === 'L6') {
        withAzure.push(l);
      }
    }
    layers = withAzure;
  }

  return { layers, strategy, continueOnError };
}

// ─── Main ───────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const options = parseArgs(args);
  if (!options) {
    process.exit(1);
  }

  log('CAIRA Deployment Strategies — Master Test Runner');
  log(`Layers: ${options.layers.join(', ')}`);
  if (options.strategy) {
    log(`Strategy: ${options.strategy}`);
  }
  log('');

  const results = await runLayers(options);
  printSummary(results);

  const allPassed = results.every((r) => r.passed || r.skipped);
  process.exit(allPassed ? 0 : 1);
}

main().catch((err: unknown) => {
  process.stderr.write(`FATAL: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
