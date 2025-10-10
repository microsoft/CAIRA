// ---------------------------------------------------------------------
// Copyright (c) Microsoft Corporation. Licensed under the MIT license.
// ---------------------------------------------------------------------

// @ts-check

import path from 'path';
import fs from 'fs';

/** @param {import('@actions/github-script').AsyncFunctionArguments} AsyncFunctionArguments */
export default async ({ context, core }) => {
  try {
    const changes = core.getInput('CHANGES');
    const srcCore = core.getInput('SRC_CORE');

    if (!changes || typeof changes !== 'string' || changes.trim() === '') {
      core.setOutput('changes', JSON.stringify([]));
      return;
    }

    if (!context?.eventName) {
      throw new Error('GitHub context is missing or invalid');
    }

    // Determine if we're using directories or files paths
    const useDirs = context.eventName === 'workflow_dispatch' && context.payload.inputs?.tf_dirs !== '*';

    // Split changes by comma and clean up each item
    const items = changes
      .split(',')
      .map((item) => item.trim())
      .map((item) => item.replace(/^["']|["']$/g, '')) // Remove surrounding quotes (single or double)
      .filter((item) => item.length > 0);

    if (items.length === 0) {
      core.warning('No valid items found after parsing changes input');
      core.setOutput('changes', JSON.stringify([]));
      return;
    }

    // Extract directory paths based on input type
    const dirPaths = new Set();

    // Check if any changes are in modules/**/*
    const hasModuleChanges = items.some((item) => {
      const itemPath = useDirs ? item : path.dirname(item);
      return itemPath.startsWith('modules/') || itemPath.startsWith('./modules/');
    });

    // If module changes detected, add all first-level configurations directories
    if (hasModuleChanges) {
      try {
        const refArchPath = path.resolve(srcCore);
        if (fs.existsSync(refArchPath)) {
          const refArchDirs = fs
            .readdirSync(refArchPath, { withFileTypes: true })
            .filter((dirent) => dirent.isDirectory())
            .map((dirent) => `${srcCore}/${dirent.name}`);

          refArchDirs.forEach((dir) => dirPaths.add(dir));
        }
      } catch (error) {
        throw new Error(`Error processing ${srcCore}: ${error.message}`);
      }
    }

    items.forEach((item) => {
      try {
        let dirPath;

        if (useDirs) {
          // Input is already directories, use as-is
          dirPath = item;
        } else {
          // Input is files, extract directory part
          dirPath = path.dirname(item);
        }

        // validate that a file exists at dirPath
        if (!fs.existsSync(path.resolve(dirPath))) {
          throw new Error(`File does not exist: ${dirPath}`);
        }

        // If path contains "tests", truncate at that point
        if (!useDirs && dirPath.includes('/tests')) {
          // Extract everything before "/tests"
          const testsIndex = dirPath.indexOf('/tests');
          dirPath = dirPath.substring(0, testsIndex);
        }

        // Validate and normalize the path, but exclude module paths from final output
        if (dirPath && dirPath !== '.' && dirPath.length > 0 && !dirPath.includes('modules')) {
          dirPaths.add(dirPath);
        }
      } catch (error) {
        core.warning(`Failed to process item "${item}": ${error.message}`);
      }
    });

    // Convert Set to Array and sort
    const sortedDirPaths = Array.from(dirPaths).sort();

    // Build JSON array with path and basename
    const jsonOutput = sortedDirPaths.map((dirPath) => ({
      path: dirPath,
      name: path.basename(dirPath)
    }));

    const compactJson = JSON.stringify(jsonOutput);
    core.setOutput('changes', compactJson);
  } catch (error) {
    core.setFailed(error.message);
  }
};
