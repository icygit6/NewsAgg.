import js from '@eslint/js'
import tseslint from 'typescript-eslint'

// Flat config (ESLint 10). Pragmatic ruleset: genuine problems are errors,
// pre-existing style choices (any, _-prefixed unused, empty catch) are relaxed
// so `npm run lint` is a useful signal rather than thousands of warnings.
export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'coverage/**',
      'scripts/**',
      'scraping/**',
      'eslint.config.mjs',
      'vitest.config.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
      ],
      'no-empty': ['warn', { allowEmptyCatch: true }],
    },
  }
)
