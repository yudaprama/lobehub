import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  minify: false,
  target: 'es2022',
  outDir: 'dist',
  external: [
    // Don't bundle these - they'll be resolved from node_modules
    '@trpc/server',
    '@trpc/client',
    'express',
    'cors',
    'ioredis',
    'drizzle-orm',
    'postgres',
    'jsonwebtoken',
    'superjson',
    'zod',
  ],
  esbuildOptions(options) {
    // Allow importing from outside rootDir
    options.allowOverwrite = true;
  },
});
