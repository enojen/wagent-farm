import { defineConfig } from 'vitest/config';

// Root test runner. Discovers `*.test.ts` / `*.spec.ts` under every package's
// src. `passWithNoTests` keeps the suite green until the first real tests land
// in later phases. Per-package `projects` can be introduced when packages need
// divergent test setups.
export default defineConfig({
  test: {
    include: ['{apps,packages}/*/src/**/*.{test,spec}.ts'],
    passWithNoTests: true,
  },
});
