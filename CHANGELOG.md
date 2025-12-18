# Changelog

## 2.1.2

- Updated publish workflow to use OIDC.

## 2.1.1

- Updated publish workflow's way of retrieving secrets

## 2.1.0

- Adds transformPayload configuration option to allow consumers to transform the payload before sending it

## 2.0.6

- Fix broken link in readme to Rollbar API documentation
- Update dependencies to latest

## 2.0.5

- Added NPM script `validate:types` to `package.json` which uses package `@arethetypeswrong/cli` to validate that the TypeScript types published with this package are usable by consumers of this package
- Update dependencies to latest

## 2.0.4

- Added the `license` and `repository` fields to `package.json` to improve the presentation of the package on [npmjs.com](https://www.npmjs.com/)
- Add `LICENSE` MIT open-source license file to the code repository
- Add `CONTRIBUTING.md` to give guidance to contributors of this repository
- Add `MAINTAINERS.md` to identify maintainers of this repository

## 2.0.3

- Add the missing `--access public` flag to the `npm publish` command so package publishing isn't rejected

## 2.0.2

- Enable publishing to the NPM registry

## 2.0.1

- Refactored code and unit tests to account for significantly updated dependencies
- Vitest option `--coverage` removed from `test:unit` NPM script and moved into new NPM script `test:unit:coverage` because package `@vitest/coverage-v8` has a bug in it that causes messages to get logged to the console that should not be
- Added ESLint rule to require type imports to be in their own group
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
