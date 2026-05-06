/**
 * Drift validator — re-generates deployment strategies in a temp directory and
 * diffs against current deployment-strategies/ to detect hand-edits or stale output.
 *
 * This module exposes the core validation logic so it can be called both
 * from the CLI (validate-strategies.ts) and from test-all.ts (L7).
 */

import { mkdtemp, readdir, readFile, rm, stat } from 'node:fs/promises';
import type { Dirent } from 'node:fs';
import { join, relative } from 'node:path';
import { tmpdir } from 'node:os';
import { generate } from './index.ts';
import { shouldIncludeDir, shouldIncludeFile } from './copier.ts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DriftResult {
  /** True if deployment-strategies/ matches the generated output exactly. */
  readonly ok: boolean;
  /** Per-file drift details. */
  readonly diffs: readonly FileDrift[];
  /** Files in deployment-strategies/ that shouldn't be there. */
  readonly extraFiles: readonly string[];
  /** Files expected but missing from deployment-strategies/. */
  readonly missingFiles: readonly string[];
}

export interface FileDrift {
  /** Relative path from deployment-strategies/ root. */
  readonly file: string;
  /** Type of drift. */
  readonly kind: 'content-mismatch' | 'missing' | 'extra';
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Validate that deployment-strategies/ matches what the generator would produce.
 *
 * Generates into a temp directory, then compares every file byte-for-byte
 * against the existing deployment-strategies/ directory.
 */
export async function validateSamples(repoRoot: string): Promise<DriftResult> {
  const samplesDir = join(repoRoot, '..', 'deployment-strategies');

  // Check deployment-strategies/ exists
  try {
    const s = await stat(samplesDir);
    if (!s.isDirectory()) {
      return {
        ok: false,
        diffs: [],
        extraFiles: [],
        missingFiles: ['deployment-strategies/ is not a directory']
      };
    }
  } catch {
    return {
      ok: false,
      diffs: [],
      extraFiles: [],
      missingFiles: ['deployment-strategies/ directory does not exist — run generate-strategies.ts first']
    };
  }

  // Generate into a securely-created temp directory.
  const tempSamplesDir = await mkdtemp(join(tmpdir(), 'caira-validate-'));

  await generate({
    repoRoot,
    samplesDir: tempSamplesDir,
    clean: true
  });

  // Collect all files from both directories
  const expectedFiles = await collectFiles(tempSamplesDir);
  const actualFiles = await collectFiles(samplesDir);

  const expectedSet = new Set(expectedFiles);
  const actualSet = new Set(actualFiles);

  const diffs: FileDrift[] = [];
  const missingFiles: string[] = [];
  const extraFiles: string[] = [];

  // Check for missing files (in expected but not in actual)
  for (const file of expectedFiles) {
    if (!actualSet.has(file)) {
      missingFiles.push(file);
      diffs.push({ file, kind: 'missing' });
    }
  }

  // Check for extra files (in actual but not in expected)
  for (const file of actualFiles) {
    if (!expectedSet.has(file)) {
      extraFiles.push(file);
      diffs.push({ file, kind: 'extra' });
    }
  }

  // Check content of files that exist in both
  for (const file of expectedFiles) {
    if (!actualSet.has(file)) continue; // Already flagged as missing

    const expectedContent = await readFile(join(tempSamplesDir, file), 'utf-8');
    const actualContent = await readFile(join(samplesDir, file), 'utf-8');

    // Normalize line endings to avoid false positives on Windows checkouts
    if (expectedContent.replace(/\r\n/g, '\n') !== actualContent.replace(/\r\n/g, '\n')) {
      diffs.push({ file, kind: 'content-mismatch' });
    }
  }

  // Clean up temp directory
  await rm(tempSamplesDir, { recursive: true, force: true });

  return {
    ok: diffs.length === 0,
    diffs,
    extraFiles,
    missingFiles
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// File and directory skip logic is shared with copier.ts via
// shouldIncludeFile / shouldIncludeDir to prevent drift between the
// generation and validation walk filters.

/** Recursively collect all file paths relative to the given root. */
async function collectFiles(root: string): Promise<string[]> {
  const files: string[] = [];
  await walkDir(root, root, files);
  return files.sort();
}

async function walkDir(dir: string, root: string, files: string[]): Promise<void> {
  let entries: Dirent[];
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (!shouldIncludeDir(entry.name)) continue;

    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      await walkDir(full, root, files);
    } else if (entry.isFile()) {
      if (!shouldIncludeFile(entry.name)) continue;
      files.push(relative(root, full));
    }
  }
}
