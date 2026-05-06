/**
 * Component copier — copies a component directory into a sample project,
 * filtering out build artifacts and adjusting tsconfig extends paths.
 */

import { constants } from 'node:fs';
import { readdir, readFile, mkdir, writeFile, copyFile } from 'node:fs/promises';
import type { Dirent } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { toPortablePath, pathIsInside } from './utils.ts';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Directories to skip during copy and drift validation. */
const SKIP_DIRS = new Set([
  'node_modules',
  'dist',
  '.turbo',
  'coverage',
  '.nyc_output',
  '.vite',
  '.terraform',
  'bin',
  'obj'
]);

/** Files to skip during copy and drift validation. */
const SKIP_FILES = new Set(['package-lock.json', '.dockerignore', '.env', '.terraform.lock.hcl']);

/** Files that need tsconfig extends path rewriting (also used by self-containment checks). */
export const TSCONFIG_FILES = new Set(['tsconfig.json', 'tsconfig.node.json', 'tsconfig.app.json']);

export interface CopyOptions {
  /**
   * Absolute path to the shared Terraform modules root in strategy-builder/infra/modules.
   * When provided with vendoredTerraformModulesDir, local module sources are rewritten
   * to point at vendored copies inside the generated deployment strategy.
   */
  readonly sharedTerraformModulesRoot?: string | undefined;
  /** Absolute path to the vendored modules directory inside the generated strategy. */
  readonly vendoredTerraformModulesDir?: string | undefined;
}

async function writeNewFile(path: string, content: string): Promise<void> {
  await writeFile(path, content, { flag: 'wx' });
}

function toPortableRelativePath(fromPath: string, toPath: string): string {
  const rel = toPortablePath(relative(fromPath, toPath));
  if (rel === '') return '.';
  return rel.startsWith('.') ? rel : `./${rel}`;
}

/**
 * Rewrite local Terraform module source paths so generated strategies resolve
 * only against vendored copies under infra/modules/.
 */
function transformTerraformModuleSources(
  content: string,
  sourceFilePath: string,
  targetFilePath: string,
  options: CopyOptions,
  terraformModuleDependencies: Set<string>
): string {
  const { sharedTerraformModulesRoot, vendoredTerraformModulesDir } = options;
  if (!sharedTerraformModulesRoot || !vendoredTerraformModulesDir) {
    return content;
  }

  return content.replace(/(\bsource\s*=\s*")([^"\r\n]+)(")/g, (match, prefix, sourceValue, suffix) => {
    if (!sourceValue.startsWith('.')) {
      return match;
    }

    const resolvedSource = resolve(dirname(sourceFilePath), sourceValue);
    if (!pathIsInside(sharedTerraformModulesRoot, resolvedSource)) {
      return match;
    }

    const moduleRelPath = toPortablePath(relative(sharedTerraformModulesRoot, resolvedSource));
    terraformModuleDependencies.add(moduleRelPath);

    const vendoredModulePath = join(vendoredTerraformModulesDir, moduleRelPath);
    const rewrittenSource = toPortableRelativePath(dirname(targetFilePath), vendoredModulePath);

    return `${prefix}${rewrittenSource}${suffix}`;
  });
}

// ---------------------------------------------------------------------------
// tsconfig transform
// ---------------------------------------------------------------------------

/**
 * Rewrite the "extends" path in a tsconfig.json file.
 *
 * Component tsconfigs extend the repo-root tsconfig.base.json via a
 * depth-dependent relative path (e.g., "../../../../tsconfig.base.json").
 * In the generated sample, each component sits at `<sample>/<role>/`, so
 * the correct extends path is always "../tsconfig.base.json".
 */
export function transformTsconfigExtends(content: string): string {
  // Match "extends": "<anything>/tsconfig.base.json" and rewrite
  return content.replace(/("extends"\s*:\s*")(?:\.\.\/)+tsconfig\.base\.json(")/g, '$1../tsconfig.base.json$2');
}

// ---------------------------------------------------------------------------
// File filter
// ---------------------------------------------------------------------------

/** Returns true if the file should be included during copy. */
export function shouldIncludeFile(name: string): boolean {
  if (SKIP_FILES.has(name) || name.endsWith('.tsbuildinfo')) return false;
  if (name.endsWith('.tfstate') || name.includes('.tfstate.')) return false;
  if (name.endsWith('.auto.tfvars.json')) return false;
  return true;
}

/** Returns true if the directory should be recursed into during copy. */
export function shouldIncludeDir(name: string): boolean {
  return !SKIP_DIRS.has(name);
}

// ---------------------------------------------------------------------------
// Copy logic
// ---------------------------------------------------------------------------

/**
 * Result of a copy operation — tracks what was copied for manifest/logging.
 */
export interface CopyResult {
  /** Files copied (relative paths from the component root). */
  readonly files: readonly string[];
  /** Directories created. */
  readonly dirs: readonly string[];
  /** Files that had their tsconfig extends path transformed. */
  readonly transformed: readonly string[];
  /** Terraform modules under strategy-builder/infra/modules referenced by copied .tf files. */
  readonly terraformModuleDependencies: readonly string[];
}

/**
 * Copy a component directory into a target directory within a sample.
 *
 * Recursively copies all files except those in SKIP_DIRS/SKIP_FILES.
 * Transforms tsconfig extends paths to point at the sample-level base.
 *
 * @param sourceDir - Absolute path to the component directory.
 * @param targetDir - Absolute path to the target directory in the sample.
 * @param options - Optional copy-time rewrites for Terraform module vendoring.
 * @returns Copy result with lists of files, dirs, transforms, and Terraform module deps.
 */
export async function copyComponent(
  sourceDir: string,
  targetDir: string,
  options: CopyOptions = {}
): Promise<CopyResult> {
  const files: string[] = [];
  const dirs: string[] = [];
  const transformed: string[] = [];
  const terraformModuleDependencies = new Set<string>();

  await copyDir(sourceDir, targetDir, '', files, dirs, transformed, terraformModuleDependencies, options);

  return {
    files,
    dirs,
    transformed,
    terraformModuleDependencies: [...terraformModuleDependencies].sort((a, b) => a.localeCompare(b))
  };
}

/**
 * Internal recursive copy. Tracks relative paths for reporting.
 */
async function copyDir(
  sourceDir: string,
  targetDir: string,
  relPrefix: string,
  files: string[],
  dirs: string[],
  transformed: string[],
  terraformModuleDependencies: Set<string>,
  options: CopyOptions
): Promise<void> {
  await mkdir(targetDir, { recursive: true });
  if (relPrefix) {
    dirs.push(relPrefix);
  }

  const entries = await readdir(sourceDir, { withFileTypes: true });

  for (const entry of entries) {
    const sourcePath = join(sourceDir, entry.name);
    const targetPath = join(targetDir, entry.name);
    const relPath = relPrefix ? `${relPrefix}/${entry.name}` : entry.name;

    if (entry.isDirectory()) {
      if (!shouldIncludeDir(entry.name)) continue;
      await copyDir(sourcePath, targetPath, relPath, files, dirs, transformed, terraformModuleDependencies, options);
    } else if (entry.isFile()) {
      if (!shouldIncludeFile(entry.name)) continue;

      // Tsconfig files and Terraform wrappers may need path rewriting
      if (TSCONFIG_FILES.has(entry.name) || entry.name.endsWith('.tf')) {
        const content = await readFile(sourcePath, 'utf-8');
        let rewritten = content;
        if (TSCONFIG_FILES.has(entry.name)) {
          rewritten = transformTsconfigExtends(rewritten);
        }
        if (entry.name.endsWith('.tf')) {
          rewritten = transformTerraformModuleSources(
            rewritten,
            sourcePath,
            targetPath,
            options,
            terraformModuleDependencies
          );
        }
        await writeNewFile(targetPath, rewritten);
        files.push(relPath);
        if (rewritten !== content) {
          transformed.push(relPath);
        }
      } else {
        await copyFile(sourcePath, targetPath, constants.COPYFILE_EXCL);
        files.push(relPath);
      }
    }
    // Symlinks and other types are silently skipped
  }
}

/**
 * Collect the file listing for a component directory (without actually copying).
 * Useful for dry-run / drift validation.
 *
 * @param sourceDir - Absolute path to the component directory.
 * @returns List of relative file paths that would be copied.
 */
export async function listComponentFiles(sourceDir: string): Promise<string[]> {
  const files: string[] = [];
  await listDir(sourceDir, '', files);
  return files;
}

async function listDir(dir: string, relPrefix: string, files: string[]): Promise<void> {
  let entries: Dirent[];
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const relPath = relPrefix ? `${relPrefix}/${entry.name}` : entry.name;

    if (entry.isDirectory()) {
      if (!shouldIncludeDir(entry.name)) continue;
      await listDir(join(dir, entry.name), relPath, files);
    } else if (entry.isFile()) {
      if (!shouldIncludeFile(entry.name)) continue;
      files.push(relPath);
    }
  }
}
