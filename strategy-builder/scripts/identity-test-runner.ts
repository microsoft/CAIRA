#!/usr/bin/env node
/**
 * Identity Credential Validation Test Runner
 *
 * Validates that DefaultAzureCredential works inside Docker containers by:
 *   1. Checking the azurecli Docker volume has valid Azure CLI credentials
 *   2. Starting the compose stack WITHOUT mock overlay (real azcred sidecar)
 *   3. Hitting GET /identity on agent and API containers
 *   4. Asserting both return { authenticated: true }
 *   5. Tearing down the stack
 *
 * Usage:
 *   node scripts/identity-test-runner.ts \
 *     --strategy deployment-strategies/foundry_agentic_app/typescript-foundry-agent-service-aca
 */

import { existsSync } from 'node:fs';
import { readFile, writeFile, unlink } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve, basename } from 'node:path';
import {
  log,
  logError,
  runCommand,
  waitForHealthy,
  discoverContainerIp,
  getComposeFiles,
  captureContainerLogs,
  fixAzurecliPermissions
} from './lib/compose-helpers.ts';
import { generate } from './lib/generator/index.ts';
import { DEPLOYMENT_STRATEGIES_ROOT, resolveStrategyPath } from './lib/paths.ts';

const execFileAsync = promisify(execFile);

function hasCode(error: unknown, code: string): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: unknown }).code === code;
}

// ─── Types ──────────────────────────────────────────────────────────────

interface IdentityResponse {
  authenticated: boolean;
  identity?: {
    tenantId?: string;
    objectId?: string;
    displayName?: string;
    type?: string;
  };
  reason?: string;
}

interface IdentityTestOptions {
  strategyDir: string;
  healthTimeoutMs?: number | undefined;
  skipRegenerate?: boolean | undefined;
  keepAlive?: boolean | undefined;
}

interface IdentityTestResult {
  passed: boolean;
  durationMs: number;
  agentIdentity?: IdentityResponse;
  apiIdentity?: IdentityResponse;
  error?: string;
  containerLogs?: string;
}

// ─── Pre-flight: Azure CLI credentials in Docker volume ─────────────────

const VOLUME_NAME = 'azurecli';
const AZ_IMAGE = 'mcr.microsoft.com/azure-cli';

async function checkAzurecliVolume(): Promise<{ ok: boolean; message: string }> {
  // 1. Check volume exists
  try {
    await execFileAsync('docker', ['volume', 'inspect', VOLUME_NAME]);
  } catch {
    return {
      ok: false,
      message: `Docker volume '${VOLUME_NAME}' does not exist.\n` + 'Run: node scripts/azure-login.ts'
    };
  }

  // 2. Check credentials are valid inside the volume
  try {
    const result = await execFileAsync(
      'docker',
      ['run', '--rm', '-v', `${VOLUME_NAME}:/root/.azure`, AZ_IMAGE, 'az', 'account', 'show', '-o', 'json'],
      { timeout: 30_000, maxBuffer: 1024 * 1024 }
    );

    const account = JSON.parse(result.stdout.trim()) as {
      name: string;
      id: string;
      tenantId: string;
    };
    return {
      ok: true,
      message: `Logged in: ${account.name} (subscription: ${account.id}, tenant: ${account.tenantId})`
    };
  } catch (err: unknown) {
    const error = err as { stderr?: string; message?: string };
    return {
      ok: false,
      message:
        `Azure CLI credentials in volume '${VOLUME_NAME}' are invalid or expired.\n` +
        `${error.stderr ?? error.message ?? String(err)}\n` +
        'Run: node scripts/azure-login.ts'
    };
  }
}

// ─── Fetch /identity from a container ───────────────────────────────────

async function fetchIdentity(serviceName: string, ip: string, port: number): Promise<IdentityResponse> {
  const url = `http://${ip}:${port}/identity`;
  log(`  ${serviceName}: GET ${url}`);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!response.ok) {
      return { authenticated: false, reason: `HTTP ${response.status}: ${response.statusText}` };
    }

    return (await response.json()) as IdentityResponse;
  } catch (err: unknown) {
    clearTimeout(timeout);
    return {
      authenticated: false,
      reason: err instanceof Error ? err.message : String(err)
    };
  }
}

// ─── Core test ──────────────────────────────────────────────────────────

export async function runIdentityTest(options: IdentityTestOptions): Promise<IdentityTestResult> {
  const { strategyDir, healthTimeoutMs = 90_000, skipRegenerate = false, keepAlive = false } = options;

  const start = Date.now();
  const projectName = `caira-identity-${basename(strategyDir)}`;
  const repoRoot = resolve(import.meta.dirname ?? '.', '..');

  // Validate deployment strategy directory
  const composeFile = resolve(strategyDir, 'docker-compose.yml');
  if (!existsSync(composeFile)) {
    return {
      passed: false,
      durationMs: Date.now() - start,
      error: `docker-compose.yml not found in ${strategyDir}`
    };
  }

  // ── Step 1: Pre-flight — check azurecli volume ────────────────────────

  log('Step 1: Checking Azure CLI credentials in Docker volume...');
  const volumeCheck = await checkAzurecliVolume();
  if (!volumeCheck.ok) {
    return {
      passed: false,
      durationMs: Date.now() - start,
      error: volumeCheck.message
    };
  }
  log(`  ${volumeCheck.message}`);

  // ── Step 1b: Fix volume permissions for azcred sidecar ──────────────────
  // The azcred sidecar runs as uid 65532 (nonroot). Files in the azurecli
  // volume may be owned by a different uid (e.g. 1000 from devcontainer or
  // 0 from root). We chown the volume contents so the azcred sidecar can
  // read/write config, versionCheck.json, etc.

  log('Step 1b: Fixing azurecli volume permissions for azcred sidecar (uid 65532)...');
  try {
    await fixAzurecliPermissions();
    log('  Volume permissions fixed.');
  } catch (err: unknown) {
    const error = err as { stderr?: string; message?: string };
    return {
      passed: false,
      durationMs: Date.now() - start,
      error: `Failed to fix volume permissions: ${error.stderr ?? error.message ?? String(err)}`
    };
  }

  // ── Step 2: Regenerate deployment strategies ──────────────────────────

  if (!skipRegenerate) {
    log('Step 2: Regenerating deployment strategies from components...');
    try {
      const samplesDir = DEPLOYMENT_STRATEGIES_ROOT;
      await generate({ repoRoot, samplesDir, clean: true });
      log('  Deployment strategies regenerated.');
    } catch (err) {
      return {
        passed: false,
        durationMs: Date.now() - start,
        error: `Deployment strategy regeneration failed: ${err instanceof Error ? err.message : String(err)}`
      };
    }
  } else {
    log('Step 2: Skipping sample regeneration (--skip-regenerate).');
  }

  // ── Step 3: Ensure .env exists with placeholder values ─────────────────

  const envFile = resolve(strategyDir, '.env');
  let createdEnv = false;

  log('Step 3: Ensuring .env exists with placeholder values (agent needs endpoint to start)...');
  // The agent containers require an endpoint env var to pass config validation
  // at startup. We provide a placeholder — no real calls are made during the
  // identity test. We detect which vars are needed from .env.example.
  const envExamplePath = resolve(strategyDir, '.env.example');
  const placeholders: Record<string, string> = {
    AZURE_AI_PROJECT_ENDPOINT: 'https://placeholder.services.ai.azure.com',
    AZURE_OPENAI_ENDPOINT: 'https://placeholder.openai.azure.com'
  };

  const envLines: string[] = ['# Auto-generated by identity-test-runner (placeholder values)'];
  if (existsSync(envExamplePath)) {
    const example = await readFile(envExamplePath, 'utf-8');
    for (const line of example.split('\n')) {
      const match = line.match(/^([A-Z_]+)=$/);
      if (match) {
        const key = match[1] ?? '';
        if (placeholders[key]) {
          envLines.push(`${key}=${placeholders[key]}`);
        }
      }
    }
  } else {
    // Fallback: set both possible endpoint vars
    for (const [k, v] of Object.entries(placeholders)) {
      envLines.push(`${k}=${v}`);
    }
  }

  try {
    await writeFile(envFile, envLines.join('\n') + '\n', { flag: 'wx' });
    createdEnv = true;
    log(`  Created .env with placeholders: ${envLines.filter((l) => !l.startsWith('#')).join(', ')}`);
  } catch (err) {
    if (!hasCode(err, 'EEXIST')) {
      throw err;
    }
    log('Step 3: .env already exists, using existing values.');
  }

  // ── Step 4: Start compose (no mock overlay) ───────────────────────────

  // ── Step 4: Start compose (no mock overlay) ───────────────────────────

  // No overlay — uses the real azcred sidecar with the azurecli volume
  const composeFiles = getComposeFiles(strategyDir, null);

  log('Step 4: Starting compose stack (no mock overlay)...');
  const upResult = await runCommand('docker', ['compose', ...composeFiles, '-p', projectName, 'up', '-d', '--build'], {
    cwd: strategyDir,
    timeoutMs: 300_000
  });

  const lowerStderr = (upResult.stderr ?? '').toLowerCase();
  if (lowerStderr.includes('error') || lowerStderr.includes('failed')) {
    // Check if it's a real error (docker compose sends progress to stderr)
    if (
      !upResult.stderr.includes('Started') &&
      !upResult.stderr.includes('Running') &&
      !upResult.stderr.includes('Healthy')
    ) {
      return {
        passed: false,
        durationMs: Date.now() - start,
        error: `Compose up failed:\n${upResult.stderr}`
      };
    }
  }

  try {
    // ── Step 5: Wait for frontend health ──────────────────────────────────

    log(`Step 5: Waiting for services to become healthy (timeout: ${healthTimeoutMs / 1000}s)...`);

    const frontendIp = await discoverContainerIp(projectName, 'frontend');
    if (!frontendIp) {
      const logs = await captureContainerLogs(composeFiles, projectName, strategyDir);
      return {
        passed: false,
        durationMs: Date.now() - start,
        error: 'Could not discover frontend container IP.',
        containerLogs: logs
      };
    }

    const frontendUrl = `http://${frontendIp}:8080`;
    const healthy = await waitForHealthy(`${frontendUrl}/health`, healthTimeoutMs);

    if (!healthy) {
      const logs = await captureContainerLogs(composeFiles, projectName, strategyDir);
      return {
        passed: false,
        durationMs: Date.now() - start,
        error: `Services did not become healthy within ${healthTimeoutMs / 1000}s.`,
        containerLogs: logs
      };
    }

    log('  All services healthy.');

    // ── Step 6: Discover agent and API container IPs ──────────────────────

    log('Step 6: Discovering container IPs...');

    const agentIp = await discoverContainerIp(projectName, 'agent');
    const apiIp = await discoverContainerIp(projectName, 'api');

    if (!agentIp) {
      const logs = await captureContainerLogs(composeFiles, projectName, strategyDir);
      return {
        passed: false,
        durationMs: Date.now() - start,
        error: 'Could not discover agent container IP.',
        containerLogs: logs
      };
    }

    if (!apiIp) {
      const logs = await captureContainerLogs(composeFiles, projectName, strategyDir);
      return {
        passed: false,
        durationMs: Date.now() - start,
        error: 'Could not discover API container IP.',
        containerLogs: logs
      };
    }

    log(`  agent: ${agentIp}:3000`);
    log(`  api:   ${apiIp}:4000`);

    // ── Step 7: Hit /identity endpoints ───────────────────────────────────

    log('Step 7: Validating /identity endpoints...');

    const agentIdentity = await fetchIdentity('agent', agentIp, 3000);
    const apiIdentity = await fetchIdentity('api', apiIp, 4000);

    // ── Step 8: Assert results ────────────────────────────────────────────

    log('');
    log('Results:');
    log('────────');

    const failures: string[] = [];

    if (agentIdentity.authenticated) {
      const id = agentIdentity.identity;
      log(`  agent:  authenticated=true`);
      log(`          tenantId=${id?.tenantId ?? 'N/A'}`);
      log(`          objectId=${id?.objectId ?? 'N/A'}`);
      log(`          displayName=${id?.displayName ?? 'N/A'}`);
      log(`          type=${id?.type ?? 'N/A'}`);
    } else {
      log(`  agent:  authenticated=false — ${agentIdentity.reason ?? 'unknown reason'}`);
      failures.push(`Agent /identity returned authenticated=false: ${agentIdentity.reason ?? 'unknown'}`);
    }

    if (apiIdentity.authenticated) {
      const id = apiIdentity.identity;
      log(`  api:    authenticated=true`);
      log(`          tenantId=${id?.tenantId ?? 'N/A'}`);
      log(`          objectId=${id?.objectId ?? 'N/A'}`);
      log(`          displayName=${id?.displayName ?? 'N/A'}`);
      log(`          type=${id?.type ?? 'N/A'}`);
    } else {
      log(`  api:    authenticated=false — ${apiIdentity.reason ?? 'unknown reason'}`);
      failures.push(`API /identity returned authenticated=false: ${apiIdentity.reason ?? 'unknown'}`);
    }

    const passed = failures.length === 0;

    if (!passed) {
      const logs = await captureContainerLogs(composeFiles, projectName, strategyDir);
      return {
        passed: false,
        durationMs: Date.now() - start,
        agentIdentity,
        apiIdentity,
        error: failures.join('\n'),
        containerLogs: logs
      };
    }

    return {
      passed: true,
      durationMs: Date.now() - start,
      agentIdentity,
      apiIdentity
    };
  } finally {
    if (!keepAlive) {
      log('');
      log('Tearing down compose stack...');
      await runCommand(
        'docker',
        ['compose', ...composeFiles, '-p', projectName, 'down', '--volumes', '--remove-orphans'],
        { cwd: strategyDir, timeoutMs: 60_000 }
      );
      log('Stack torn down.');
    } else {
      log('Keeping stack alive (--keep-alive).');
    }

    // Clean up temporary .env if we created it
    if (createdEnv) {
      try {
        await unlink(envFile);
      } catch {
        // Ignore cleanup errors
      }
    }
  }
}

// ─── CLI ────────────────────────────────────────────────────────────────

function printUsage(): void {
  process.stdout.write(`
Identity Credential Validation Test

Validates that DefaultAzureCredential works inside Docker containers
via the credentials proxy sidecar.

Usage:
  node scripts/identity-test-runner.ts [options]

Options:
  --strategy <path>      Path to the deployment strategy directory (required)
  --health-timeout <ms>  Health check timeout in ms (default: 90000)
  --keep-alive           Keep the stack running after test
  --skip-regenerate      Skip regenerating deployment strategies before testing
  --help                 Show this help message

Prerequisites:
  1. Azure CLI login via Docker volume:
     node scripts/azure-login.ts

Example:
  node scripts/identity-test-runner.ts \\
    --strategy deployment-strategies/foundry_agentic_app/typescript-foundry-agent-service-aca
`);
}

interface ParsedArgs {
  strategyDir: string;
  healthTimeoutMs?: number | undefined;
  keepAlive: boolean;
  skipRegenerate: boolean;
}

function parseArgs(args: string[]): ParsedArgs | null {
  let strategyDir: string | undefined;
  let healthTimeoutMs: number | undefined;
  let keepAlive = false;
  let skipRegenerate = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i] ?? '';
    switch (arg) {
      case '--strategy':
        strategyDir = args[++i];
        break;
      case '--health-timeout':
        healthTimeoutMs = Number(args[++i]);
        break;
      case '--keep-alive':
        keepAlive = true;
        break;
      case '--skip-regenerate':
        skipRegenerate = true;
        break;
      case '--help':
        printUsage();
        process.exit(0);
        break;
      default:
        logError(`Unknown option: ${arg}`);
        printUsage();
        process.exit(1);
    }
  }

  if (!strategyDir) {
    logError('--strategy <path> is required');
    printUsage();
    return null;
  }

  return {
    strategyDir: resolveStrategyPath(strategyDir),
    healthTimeoutMs,
    keepAlive,
    skipRegenerate
  };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const parsed = parseArgs(args);
  if (!parsed) {
    process.exit(1);
  }

  process.stdout.write('\n');
  process.stdout.write('═'.repeat(60) + '\n');
  process.stdout.write('  Identity Credential Validation Test\n');
  process.stdout.write(`  Strategy: ${basename(parsed.strategyDir)}\n`);
  process.stdout.write('═'.repeat(60) + '\n');
  process.stdout.write('\n');

  const result = await runIdentityTest({
    strategyDir: parsed.strategyDir,
    healthTimeoutMs: parsed.healthTimeoutMs,
    keepAlive: parsed.keepAlive,
    skipRegenerate: parsed.skipRegenerate
  });

  process.stdout.write('\n');
  process.stdout.write('═'.repeat(60) + '\n');
  process.stdout.write(`  Result: ${result.passed ? 'PASSED' : 'FAILED'}\n`);
  process.stdout.write(`  Duration: ${(result.durationMs / 1000).toFixed(1)}s\n`);
  if (result.error) {
    process.stdout.write(`  Error: ${result.error}\n`);
  }
  process.stdout.write('═'.repeat(60) + '\n');

  if (result.containerLogs) {
    process.stdout.write('\n--- Container Logs ---\n');
    process.stdout.write(result.containerLogs);
    process.stdout.write('--- End Container Logs ---\n');
  }

  process.exit(result.passed ? 0 : 1);
}

const isMain = import.meta.url === `file://${process.argv[1]}` || import.meta.filename === process.argv[1];

if (isMain) {
  main().catch((err: unknown) => {
    logError(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
}
