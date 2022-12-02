#!/usr/bin/env node

// External Imports
import { access, readFile, readdir } from 'node:fs/promises';
import { ESLint } from 'eslint'; // eslint-disable-line import/no-extraneous-dependencies -- dev scripts should not affect production install sizes
import fs from 'node:fs';
import semver from 'semver'; // eslint-disable-line import/no-extraneous-dependencies -- dev scripts should not affect production install sizes

// Internal Imports
import { printError, printSuccess } from '../modules/consoleUtils.mjs';

// Local Variables
const filePaths = {
  githubWorkflowsDirectory: './.github/workflows/',
  packageJson: './package.json',
  packageLock: './package-lock.json',
  vscodeConfig: './jsconfig.json',
};

// Local Functions
function hasMatchingVersions({ actualVersions, expectedVersions }) {
  return Object.keys(actualVersions).every((key) => {
    switch (key) {
      case 'node':
      case 'gitHubNodeVersion':
        return semver.satisfies(actualVersions[key], expectedVersions[key]);

      default:
        return actualVersions[key] === expectedVersions[key];
    }
  });
}

function getNpmVersion() {
  const npmVersionRegex = /\bnpm\/(\d+\.\d+\.\d+)\b/;
  return process.env.npm_config_user_agent.match(npmVersionRegex)[1];
}

async function getGitHubWorkflowNodeVersion(workflowsDirectory) {
  const nodeVersionRegex = /\bnode-version:\s*"([^"]+)"/;
  const workflowVersions = {};
  const workflowFileNames = await readdir(workflowsDirectory);
  await Promise.all(
    workflowFileNames.map((fileName) =>
      readFile(`${workflowsDirectory}/${fileName}`, 'utf8').then((workflowContents) => {
        const match = workflowContents.match(nodeVersionRegex);
        workflowVersions[(match && match[1]) || 'FORMAT_ERROR'] = true;
      }),
    ),
  );
  return Object.keys(workflowVersions).join(',');
}

async function getEnvironmentVersions() {
  // Read file contents and ESLint configuration
  const eslint = new ESLint();
  const filesContents = await Promise.all([
    eslint.calculateConfigForFile('./*'),
    readFile(filePaths.packageJson, 'utf8'),
    readFile(filePaths.packageLock, 'utf8'),
    readFile(filePaths.vscodeConfig, 'utf8'),
  ]);

  // Create objects from JSON text
  const [eslintConfig, packageJsonContents, packageLockContents, vscodeConfigContents] =
    filesContents.map((data) => (typeof data === 'string' ? JSON.parse(data) : data));

  // Get the target ECMAScript version from ESLint; configuration computed from combined set of config files
  let ecmaVersion = eslintConfig?.parserOptions?.ecmaVersion;
  if (!ecmaVersion) {
    ecmaVersion = 'ERROR_ESLINT_NO_ECMA_VERSION';
  }

  return {
    actualVersions: {
      app: packageLockContents.version,
      esVersion: vscodeConfigContents.compilerOptions.target,
      gitHubNodeVersion: await getGitHubWorkflowNodeVersion(filePaths.githubWorkflowsDirectory),
      node: process.versions.node,
      npm: getNpmVersion(),
    },
    expectedVersions: {
      app: packageJsonContents.version,
      esVersion: `es${ecmaVersion}`,
      gitHubNodeVersion: packageJsonContents.engines.node,
      node: packageJsonContents.engines.node,
      npm: packageJsonContents.packageManager?.split('npm@')[1] ?? packageJsonContents.engines.npm,
    },
  };
}

async function hasExpectedFiles() {
  try {
    const existingFilesPromises = Object.values(filePaths).map((filePath) =>
      access(filePath, fs.constants.R_OK),
    );
    await Promise.all(existingFilesPromises);
    return true;
  } catch {
    return false;
  }
}

// BEGIN EXECUTION:
// Check that all expected files exist
if (!(await hasExpectedFiles())) {
  printError('Some or all of these expected files are missing:');
  for (const path of Object.values(filePaths)) {
    printError(path);
  }
  process.exit(1);
}

// Check that all expected environment versions match the actual versions
const environmentVersions = await getEnvironmentVersions();
if (!hasMatchingVersions(environmentVersions)) {
  printError(
    'One or more environment version mismatches occurred:\n' +
      `ACTUAL:   ${JSON.stringify(environmentVersions.actualVersions, undefined, 2)}\n` +
      `EXPECTED: ${JSON.stringify(environmentVersions.expectedVersions, undefined, 2)}`,
  );
  process.exit(1);
}

// Success!!!
printSuccess('Expected and actual environment versions are identical');
