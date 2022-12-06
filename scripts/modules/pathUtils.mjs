// External Imports
import { access, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import fs from 'node:fs';

// Local Functions
async function getFilesRecursive(targetDirectory, ignore = ['node_modules']) {
  const directoryPathAbsolute = resolve(targetDirectory);
  const directoryEntries = await readdir(directoryPathAbsolute, { withFileTypes: true });
  const recursiveEntries = await Promise.all(
    directoryEntries.map((entry) => {
      if (ignore.includes(entry.name)) {
        return '';
      }
      const pathAbsolute = resolve(directoryPathAbsolute, entry.name);
      return entry.isDirectory() ? getFilesRecursive(pathAbsolute) : pathAbsolute;
    }),
  );
  return recursiveEntries.flat(Number.POSITIVE_INFINITY).filter(Boolean);
}

async function isDirectoryAccessible(path) {
  try {
    // eslint-disable-next-line no-bitwise -- following the documentation for fs constants: https://nodejs.org/docs/latest-v16.x/api/fs.html#fspromisesaccesspath-mode
    await access(path, fs.constants.R_OK | fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

// Module Exports
export { getFilesRecursive, isDirectoryAccessible };
