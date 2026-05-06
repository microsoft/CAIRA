/**
 * Generator orchestrator — ties together discovery, matrix, copier, and file
 * generators to produce self-contained deployment strategies.
 */

import type { Dirent } from 'node:fs';
import { readFile, writeFile, mkdir, readdir, rm } from 'node:fs/promises';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { discoverComponents } from './discovery.ts';
import { discoverReferenceArchitectures } from './reference-architectures.ts';
import { buildMatrix } from './matrix.ts';
import { copyComponent, shouldIncludeDir, TSCONFIG_FILES } from './copier.ts';
import { generateSampleFiles } from './files.ts';
import { toPortablePath, pathIsInside } from './utils.ts';
import type { SampleConfig } from './types.ts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GenerateOptions {
  /** Absolute path to the repository root. */
  readonly repoRoot: string;
  /** Absolute path to the deployment strategy output directory. */
  readonly samplesDir: string;
  /**
   * If true, remove the output directory before generating.
   * Default: true.
   */
  readonly clean?: boolean | undefined;
}

export interface GenerateResult {
  /** Per-sample generation details. */
  readonly details: readonly SampleDetail[];
}

export interface SampleDetail {
  readonly name: string;
  readonly dir: string;
  /** Number of files copied from components. */
  readonly componentFilesCopied: number;
  /** Number of generated files written (compose, readme, metadata, etc.). */
  readonly generatedFilesWritten: number;
  /** Number of extra files copied (contracts, scripts, etc.). */
  readonly extraFilesCopied: number;
}

async function writeNewFile(path: string, content: string): Promise<void> {
  await writeFile(path, content, { flag: 'wx' });
}

function hasCode(error: unknown, code: string): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: unknown }).code === code;
}

// ---------------------------------------------------------------------------
// Generate
// ---------------------------------------------------------------------------

/**
 * Run the full generation pipeline:
 * 1. Discover components
 * 2. Build combination matrix
 * 3. For each sample: copy components, generate files, copy extras
 */
export async function generate(options: GenerateOptions): Promise<GenerateResult> {
  const { repoRoot, samplesDir, clean = true } = options;

  const componentsRoot = join(repoRoot, 'components');
  const referenceArchitecturesRoot = join(repoRoot, 'infra', 'reference-architectures');
  const sharedTerraformModulesRoot = join(repoRoot, 'infra', 'modules');

  // 1. Discover
  const components = await discoverComponents(componentsRoot, repoRoot);
  const referenceArchitectures = await discoverReferenceArchitectures(referenceArchitecturesRoot, repoRoot);

  // 2. Matrix
  const matrix = buildMatrix(components, referenceArchitectures);

  if (matrix.skipped.length > 0) {
    for (const skip of matrix.skipped) {
      console.warn(`  SKIP: ${skip.language}/${skip.agentVariant} — ${skip.reason}`);
    }
  }

  if (matrix.samples.length === 0) {
    throw new Error('No valid sample combinations found. Check component manifests.');
  }

  // 3. Clean output directory
  if (clean) {
    await rm(samplesDir, { recursive: true, force: true });
  }
  await mkdir(samplesDir, { recursive: true });

  // Read shared files that get copied into every sample
  const tsconfigBase = await readFile(join(repoRoot, 'tsconfig.base.json'), 'utf-8');

  // 4. Generate each sample
  const details: SampleDetail[] = [];

  for (const config of matrix.samples) {
    const detail = await generateSample(config, samplesDir, repoRoot, tsconfigBase, sharedTerraformModulesRoot);
    details.push(detail);
  }

  return { details };
}

// ---------------------------------------------------------------------------
// Per-sample generation
// ---------------------------------------------------------------------------

async function generateSample(
  config: SampleConfig,
  samplesDir: string,
  repoRoot: string,
  tsconfigBase: string,
  sharedTerraformModulesRoot: string
): Promise<SampleDetail> {
  const sampleDir = join(samplesDir, config.referenceArchitecture.manifest.id, config.name);
  await mkdir(sampleDir, { recursive: true });

  // Copy components
  let componentFilesCopied = 0;
  let extraFilesCopied = 0;

  const agentResult = await copyComponent(config.agent.dir, join(sampleDir, 'agent'));
  componentFilesCopied += agentResult.files.length;

  const apiResult = await copyComponent(config.api.dir, join(sampleDir, 'api'));
  componentFilesCopied += apiResult.files.length;

  const frontendResult = await copyComponent(config.frontend.dir, join(sampleDir, 'frontend'));
  componentFilesCopied += frontendResult.files.length;

  // Copy the az credential sidecar (infrastructure component, not discovered)
  const azcredSource = join(repoRoot, 'components', 'azcred', 'typescript');
  const azcredResult = await copyComponent(azcredSource, join(sampleDir, 'azcred'));
  componentFilesCopied += azcredResult.files.length;

  if (config.iac) {
    const vendoredTerraformModulesDir = join(sampleDir, 'infra', 'modules');
    const iacResult = await copyComponent(config.iac.dir, join(sampleDir, 'infra'), {
      sharedTerraformModulesRoot,
      vendoredTerraformModulesDir
    });
    componentFilesCopied += iacResult.files.length;
    extraFilesCopied += await copyTerraformModuleDependencies(
      iacResult.terraformModuleDependencies,
      sharedTerraformModulesRoot,
      vendoredTerraformModulesDir
    );
  }

  // Generate files (compose, env, readme, gitignore, tsconfig.base)
  const generatedFiles = generateSampleFiles(config, tsconfigBase);
  let generatedFilesWritten = 0;

  for (const [filename, content] of generatedFiles) {
    await writeNewFile(join(sampleDir, filename), content);
    generatedFilesWritten++;
  }

  // Copy extra files: contracts, scripts
  // Contracts
  const contractsDir = join(sampleDir, 'contracts');
  await mkdir(contractsDir, { recursive: true });

  for (const contractFile of ['agent-api.openapi.yaml', 'backend-api.openapi.yaml']) {
    const src = join(repoRoot, 'contracts', contractFile);
    try {
      const content = await readFile(src, 'utf-8');
      await writeNewFile(join(contractsDir, contractFile), content);
      extraFilesCopied++;
    } catch (err) {
      if (!hasCode(err, 'ENOENT')) {
        throw err;
      }
      // Contract file not found — skip gracefully
    }
  }

  await assertStrategyIsSelfContained(sampleDir, config.relativeDir);

  return {
    name: config.relativeDir,
    dir: sampleDir,
    componentFilesCopied,
    generatedFilesWritten,
    extraFilesCopied
  };
}

async function copyTerraformModuleDependencies(
  initialDependencies: readonly string[],
  sharedTerraformModulesRoot: string,
  vendoredTerraformModulesDir: string
): Promise<number> {
  const pending = [...initialDependencies];
  const copied = new Set<string>();
  let copiedFiles = 0;

  while (pending.length > 0) {
    const moduleRelPath = pending.shift();
    if (!moduleRelPath || copied.has(moduleRelPath)) {
      continue;
    }

    copied.add(moduleRelPath);

    const result = await copyComponent(
      join(sharedTerraformModulesRoot, moduleRelPath),
      join(vendoredTerraformModulesDir, moduleRelPath),
      {
        sharedTerraformModulesRoot,
        vendoredTerraformModulesDir
      }
    );
    copiedFiles += result.files.length;

    for (const dependency of result.terraformModuleDependencies) {
      if (!copied.has(dependency)) {
        pending.push(dependency);
      }
    }
  }

  return copiedFiles;
}

async function assertStrategyIsSelfContained(strategyDir: string, strategyLabel: string): Promise<void> {
  const violations: string[] = [];
  await collectSelfContainmentViolations(strategyDir, strategyDir, violations);

  if (violations.length > 0) {
    throw new Error(
      `Generated deployment strategy ${strategyLabel} contains references outside its directory:\n${violations
        .map((violation) => `  - ${violation}`)
        .join('\n')}`
    );
  }
}

async function collectSelfContainmentViolations(dir: string, strategyDir: string, violations: string[]): Promise<void> {
  const entries: Dirent[] = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isDirectory() && !shouldIncludeDir(entry.name)) {
      continue;
    }

    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      await collectSelfContainmentViolations(fullPath, strategyDir, violations);
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    const relPath = toPortablePath(relative(strategyDir, fullPath));
    const content = await readFile(fullPath, 'utf-8');

    if (content.includes('strategy-builder/')) {
      violations.push(`${relPath}: contains forbidden strategy-builder reference`);
    }

    if (fullPath.endsWith('.tf')) {
      violations.push(...collectTerraformSourceViolations(content, fullPath, strategyDir, relPath));
    }

    const fileName = basename(fullPath);
    if (fileName === 'docker-compose.yml' || fileName === 'docker-compose.yaml') {
      violations.push(...collectComposeContextViolations(content, fullPath, strategyDir, relPath));
    }

    if (TSCONFIG_FILES.has(fileName)) {
      violations.push(...collectTsconfigExtendsViolations(content, fullPath, strategyDir, relPath));
    }
  }
}

function collectTerraformSourceViolations(
  content: string,
  filePath: string,
  strategyDir: string,
  relPath: string
): string[] {
  const violations: string[] = [];

  for (const match of content.matchAll(/\bsource\s*=\s*"([^"\r\n]+)"/g)) {
    const sourceValue = match[1];
    if (!sourceValue || !sourceValue.startsWith('.')) {
      continue;
    }

    if (!pathIsInside(strategyDir, resolve(dirname(filePath), sourceValue))) {
      violations.push(`${relPath}: Terraform source "${sourceValue}" resolves outside the strategy`);
    }
  }

  return violations;
}

function collectComposeContextViolations(
  content: string,
  filePath: string,
  strategyDir: string,
  relPath: string
): string[] {
  const violations: string[] = [];

  for (const match of content.matchAll(/^\s*context:\s*([^\s#]+)\s*$/gm)) {
    const rawContextValue = match[1];
    if (!rawContextValue) {
      continue;
    }

    const contextValue = stripEnclosingQuotes(rawContextValue);
    if (!contextValue || !contextValue.startsWith('.')) {
      continue;
    }

    if (!pathIsInside(strategyDir, resolve(dirname(filePath), contextValue))) {
      violations.push(`${relPath}: compose build context "${contextValue}" resolves outside the strategy`);
    }
  }

  return violations;
}

function collectTsconfigExtendsViolations(
  content: string,
  filePath: string,
  strategyDir: string,
  relPath: string
): string[] {
  const parsed = JSON.parse(content) as { extends?: unknown };
  if (typeof parsed.extends !== 'string' || !parsed.extends.startsWith('.')) {
    return [];
  }

  if (!pathIsInside(strategyDir, resolve(dirname(filePath), parsed.extends))) {
    return [`${relPath}: tsconfig extends "${parsed.extends}" resolves outside the strategy`];
  }

  return [];
}

function stripEnclosingQuotes(value: string): string {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }

  return value;
}

// Re-export types and functions for convenience
export type { SampleConfig } from './types.ts';
export { discoverComponents } from './discovery.ts';
export { buildMatrix } from './matrix.ts';
export { copyComponent, listComponentFiles, transformTsconfigExtends } from './copier.ts';
export { generateSampleFiles, generateComposeFile } from './files.ts';
export { validateManifest } from './discovery.ts';
