#!/usr/bin/env node

// External Imports
import { basename, resolve } from 'node:path';
import { cwd } from 'node:process';
import { exec } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import minimist from 'minimist'; // eslint-disable-line import/no-extraneous-dependencies -- dev scripts should not affect production install sizes

// Internal Imports
import {
  printError,
  printInfo,
  printSuccess,
  printWarning,
  white,
} from '../modules/consoleUtils.mjs';

// Local Variables
const currentWorkingDirectory = cwd();
const npmOutdatedCommand = 'npm outdated --depth=0 --json';
const packageJsonPath = resolve(currentWorkingDirectory, 'package.json');
let packagesToIgnore;

// Local Functions
// TODO: replace deepClone() with structuredClone() when we use Node.js 18
function deepClone(targetObject) {
  return JSON.parse(JSON.stringify(targetObject));
}

function isValidExecution({ ignorePackages }) {
  const areValidCommandLineArguments =
    process.argv.length === 2 ||
    (process.argv.length === 3 && typeof ignorePackages === 'string' && ignorePackages.length > 0);
  if (!areValidCommandLineArguments) {
    const scriptUrl = new URL(import.meta.url);
    return printError(
      `USAGE: ${basename(
        scriptUrl.pathname,
      )} [--ignore-packages=<packages_separated_by_commas_or_single_package>]`,
    );
  }
  return true;
}

async function onNpmOutdated(error, stdout) {
  // "npm outdated" has exit code 0 if everything up-to-date, 1 if anything needs to be updated
  if (error?.code > 1) {
    printError(`Unexpected exit code "${error.code}" for command "${npmOutdatedCommand}"`);
    process.exit(1);
  }

  const npmOutdatedResponse = JSON.parse(stdout);
  if (Object.keys(npmOutdatedResponse).length === 0) {
    printSuccess('No packages to update; exiting');
    process.exit(2);
  }

  printInfo(`Reading contents of file: ${white(packageJsonPath)}`);
  const packageJsonString = await readFile(packageJsonPath, 'utf8');
  const packageJson = JSON.parse(packageJsonString);
  updatePackageVersions(packageJson, npmOutdatedResponse);
}

async function updatePackageVersions(packageJson, npmOutdatedResponse) {
  // Update package.json versions
  printInfo('Updating package versions...');
  const newPackageJson = deepClone(packageJson);
  const { dependencies, devDependencies } = newPackageJson;
  const hasDependencies = typeof dependencies === 'object';
  const hasDevDependencies = typeof devDependencies === 'object'; // eslint-disable-line unicorn/prevent-abbreviations -- "devDependencies" comes from package.json

  // Verify all ignored packages exist in package.json
  for (const ignoredPackageName of packagesToIgnore) {
    const isInDependencies = hasDependencies && ignoredPackageName in dependencies;
    const isInDevDependencies = hasDevDependencies && ignoredPackageName in devDependencies; // eslint-disable-line unicorn/prevent-abbreviations -- "devDependencies" comes from package.json
    if (!isInDependencies && !isInDevDependencies) {
      printError(`Ignored package "${ignoredPackageName}" does not exist in package.json`);
      process.exit(1);
    }
  }

  // Update the matched package versions
  let packageUpdateCount = 0;
  const filteredPackageList = Object.entries(npmOutdatedResponse).filter(
    ([packageName]) => !packagesToIgnore.includes(packageName),
  );
  for (const [packageName, newVersionMetadata] of filteredPackageList) {
    if (hasDependencies && packageName in dependencies) {
      dependencies[packageName] = newVersionMetadata.latest;
      packageUpdateCount += 1;
    }
    if (hasDevDependencies && packageName in devDependencies) {
      devDependencies[packageName] = newVersionMetadata.latest;
      packageUpdateCount += 1;
    }
  }

  // Write file to disk
  if (packageUpdateCount > 0) {
    printInfo(`Writing to file: ${white(packageJsonPath)}`);
    const newPackageJsonString = JSON.stringify(newPackageJson, undefined, 2);
    await writeFile(packageJsonPath, `${newPackageJsonString}\n`);
  }

  // List behavior summary
  if (packagesToIgnore.length > 0) {
    printWarning('The following packages were ignored:');
    for (const packageName of packagesToIgnore) {
      let versionChange;
      if (packageName in npmOutdatedResponse) {
        const currentVersion = npmOutdatedResponse[packageName].current;
        const newVersion = npmOutdatedResponse[packageName].latest;
        versionChange = `${currentVersion} => ${newVersion}`;
      } else {
        versionChange = 'no change';
      }
      printWarning(`  - ${packageName} (${versionChange})`);
    }
  }

  if (packageUpdateCount === 0) {
    printSuccess('No packages to update; exiting');
    process.exit(2);
  }
  printSuccess('package.json version updating complete');
}

// BEGIN EXECUTION:
const commandLineArguments = minimist(process.argv.slice(2), {
  alias: { 'ignore-packages': 'ignorePackages' },
});
if (!(await isValidExecution(commandLineArguments))) {
  process.exit(1);
}

const { ignorePackages } = commandLineArguments;
packagesToIgnore = ignorePackages ? ignorePackages.split(',') : [];
printInfo(`Executing command: ${white(npmOutdatedCommand)}`);
exec(npmOutdatedCommand, { cwd: currentWorkingDirectory }, onNpmOutdated);
