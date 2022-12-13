/** @type {import('ts-jest/dist/types').InitialOptionsTsJest} */

// For a detailed explanation regarding each configuration property, visit:
// https://jestjs.io/docs/en/configuration.html

// eslint-disable-next-line import/no-default-export -- Jest doesn't support named exports
export default {
  clearMocks: true,
  coverageDirectory: 'jestCodeCoverage',
  coverageThreshold: {
    global: {
      lines: 100,
    },
  },
  errorOnDeprecated: true,
  maxWorkers: '100%',
  // moduleFileExtensions: ['js', 'ts', 'json'],
  preset: 'ts-jest',
  // resetMocks: true,
  // restoreMocks: true,
  testEnvironment: 'jsdom',
  testEnvironmentOptions: {
    url: 'http://localhost', // jsdom config option for location.href
  },
  testMatch: ['**/*.test.ts'],
  testPathIgnorePatterns: ['/node_modules/'],
  testTimeout: 5_000,
};
