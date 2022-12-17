import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  build: {
    emptyOutDir: true,
    lib: {
      entry: resolve(__dirname, '/src/RollbarClient.ts'),
      fileName: 'RollbarClient',
      formats: ['es'],
    },
    minify: 'esbuild',
    modulePreload: false,
    outDir: 'dist',
    sourcemap: true,
    target: 'modules',
  },
});
