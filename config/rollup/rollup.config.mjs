// External Imports
import { readFileSync } from 'node:fs';
import { terser as rollupPluginTerser } from 'rollup-plugin-terser';
import rollupPluginCommonJS from '@rollup/plugin-commonjs';
import rollupPluginDelete from 'rollup-plugin-delete';
import rollupPluginNodeResolve from '@rollup/plugin-node-resolve';
import rollupPluginReplace from '@rollup/plugin-replace';

// Local Variables
const buildDateAndTime = new Date().toLocaleString('en-US', {
  dateStyle: 'long',
  hour12: true,
  timeStyle: 'long',
  timeZone: 'UTC',
});
const buildPath = 'dist';
const chunkFileNamesPrefix = '[name]-[hash]';
const entryFileNamesPrefix = '[name]';
const { name, version } = JSON.parse(readFileSync('./package.json', 'utf8'));
const outputDefaults = {
  banner: `/* ${name} version ${version} (built on ${buildDateAndTime}) */\n`,
  compact: false,
  dir: buildPath,
  sourcemap: true,
};

// Configuration Definition
// eslint-disable-next-line import/no-default-export -- Rollup expects a default exported object for its configuration
export default {
  input: 'src/RollbarClient.js',
  output: [
    {
      ...outputDefaults,
      chunkFileNames: `${chunkFileNamesPrefix}.min.cjs`,
      entryFileNames: `${entryFileNamesPrefix}.min.cjs`,
      format: 'cjs',
    },
    {
      ...outputDefaults,
      chunkFileNames: `${chunkFileNamesPrefix}.min.mjs`,
      entryFileNames: `${entryFileNamesPrefix}.min.mjs`,
      format: 'es',
    },
  ],
  plugins: [
    rollupPluginDelete({ targets: `${buildPath}/*` }),
    rollupPluginReplace({
      preventAssignment: true, // TODO: remove this once "true" becomes the default; this is only here to suppress the upgrade warning
      'process.env.npm_package_name': JSON.stringify(name),
      'process.env.npm_package_version': JSON.stringify(version),
    }),
    rollupPluginNodeResolve(),
    rollupPluginCommonJS(),
    rollupPluginTerser({
      output: { comments: new RegExp(`^\\s*${name}`) },
    }),
  ],
  strictDeprecations: true,
};
