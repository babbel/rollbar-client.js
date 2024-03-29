/// <reference types="vitest" />

import { defineConfig } from 'vite'; // eslint-disable-line import/no-extraneous-dependencies -- this is a dev-only dependency
import { fileURLToPath } from 'node:url';

// eslint-disable-next-line import/no-default-export -- default export is a Vite requirement
export default defineConfig({
  build: {
    emptyOutDir: true,
    lib: {
      entry: fileURLToPath(new URL('/src/RollbarClient.mts', import.meta.url)),
      fileName: 'RollbarClient',
      formats: ['es'],
    },
    minify: 'esbuild',
    modulePreload: false,
    outDir: 'dist',
    sourcemap: true,
    target: 'modules',
  },
  test: {
    clearMocks: true,
    coverage: {
      provider: 'v8',
      reportsDirectory: './vitestCodeCoverage',
    },
    environment: 'happy-dom',
  },
});
