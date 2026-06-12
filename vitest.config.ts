import { defineConfig } from 'vitest/config';

// passWithNoTests keeps the suite green until the first tests land.
export default defineConfig({
  test: {
    include: ['{apps,packages}/*/src/**/*.{test,spec}.ts'],
    passWithNoTests: true,
  },
});
