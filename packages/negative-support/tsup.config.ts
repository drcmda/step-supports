import { defineConfig } from 'tsup';

export default defineConfig([
  // Library (ESM + CJS + types)
  {
    entry: ['src/index.ts'],
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
    clean: true,
    external: ['manifold-3d', 'occt-import-js'],
  },
  // CLI (ESM only, Node.js target)
  {
    entry: ['src/cli.ts'],
    format: ['esm'],
    sourcemap: true,
    external: ['manifold-3d', 'occt-import-js'],
    // Add shebang for npx/bin usage
    esbuildOptions(options) {
      options.banner = { js: '#!/usr/bin/env node' };
    },
  },
]);
