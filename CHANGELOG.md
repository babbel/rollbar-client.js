# Changelog

## 2.0.1

- Refactored code and unit tests to account for significantly updated dependencies
- Added ESLint rule to require type imports to be in their own group
- Modified `tsconfig.json` to allow TypeScript file extensions in import strings via rule `allowImportingTsExtensions`
- Replaced Vitest coverage reporter `c8` with `v8` as necessitated by the migration to Vitest version `0.32.0`
- `validate:environment` NPM script now executes its subtasks in parallel
- Update GitHub Action workflow files to use Node.js version `18.16.1`
- Update expected internal NPM version to `9.5.1`
- Remove dev dependency `@vscode/ripgrep`, instead rely on locally-installed version because NPM package installs fail too often
- Update dependencies to latest

## 2.0.0

- Convert code to TypeScript
- Convert code building from Rollup to Vite v4
- Convert unit testing from Jest to Vitest

## 1.0.0

- Initial package publish
