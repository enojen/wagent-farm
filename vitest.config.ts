import { defineConfig } from 'vitest/config';

// passWithNoTests keeps the suite green until the first tests land.
export default defineConfig({
  test: {
    include: ['{apps,packages}/*/src/**/*.{test,spec}.ts'],
    passWithNoTests: true,
    // PGlite's WASM cold init can exceed the 10s default when files run in parallel.
    hookTimeout: 60_000,
    // Full parallelism makes the per-file PGlite WASM inits contend; 4 is faster.
    maxWorkers: 4,
  },
});
