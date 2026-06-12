// @ts-check
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// CLAUDE.md §12.1: mastra may be imported only in packages/agents and
// packages/tools, keeping the framework choice reversible.
const MASTRA_IMPORT_BAN = [
  {
    group: ['mastra', 'mastra/*', '@mastra/*'],
    message:
      'mastra is allowed only in packages/agents and packages/tools (CLAUDE.md §12.1).',
  },
];

export default tseslint.config(
  {
    ignores: ['**/dist/**', '**/node_modules/**', '**/*.tsbuildinfo'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,mts,cts}'],
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      // typescript-eslint variant so `import type` is caught too.
      '@typescript-eslint/no-restricted-imports': [
        'error',
        { patterns: MASTRA_IMPORT_BAN },
      ],
    },
  },
  {
    // The two packages that own the Mastra dependency — boundary lifted.
    files: ['packages/agents/**', 'packages/tools/**'],
    rules: {
      '@typescript-eslint/no-restricted-imports': 'off',
    },
  },
);
