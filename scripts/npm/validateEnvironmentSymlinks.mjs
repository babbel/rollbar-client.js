#!/usr/bin/env node

// External Imports
import { lstat } from 'node:fs/promises';
import { realpathSync } from 'node:fs';

// Internal Imports
import { getFilesRecursive } from '../modules/pathUtils.mjs';
import { printError, printSuccess } from '../modules/consoleUtils.mjs';

// BEGIN EXECUTION:
const brokenSymlinkPaths = [];
const filePaths = await getFilesRecursive('.');
const fileStatList = await Promise.all(filePaths.map((path) => lstat(path)));
for (const [index, fileStats] of fileStatList.entries()) {
  if (fileStats.isSymbolicLink()) {
    const path = filePaths[index];
    try {
      realpathSync(path);
    } catch {
      brokenSymlinkPaths.push(path);
    }
  }
}

if (brokenSymlinkPaths.length > 0) {
  printError('The following symlinks point to a non-existant file:');
  for (const path of brokenSymlinkPaths) {
    printError(`- ${path}`);
  }
  process.exit(1);
}
printSuccess('All project symlinks are valid');
