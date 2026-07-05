/**
 * Shared ESLint preset — extended by every TypeScript workspace via
 * `"extends": ["@gym-saas/eslint-config"]`. Rules follow
 * docs/coding-guidelines/CODING-STANDARDS.md (no `any`, no floating
 * promises, no console outside the logger module).
 */
module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    // Type-aware rules (no-floating-promises) need a tsconfig; `project: true`
    // auto-discovers the nearest one per linted file so this stays generic
    // across every workspace that extends this config.
    project: true,
    tsconfigRootDir: process.cwd(),
  },
  plugins: ['@typescript-eslint', 'import'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'prettier',
  ],
  rules: {
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-floating-promises': 'error',
    '@typescript-eslint/consistent-type-imports': 'error',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    'no-console': 'error',
    'import/order': [
      'error',
      {
        groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
        'newlines-between': 'always',
        alphabetize: { order: 'asc' },
      },
    ],
  },
  env: {
    es2022: true,
    node: true,
  },
};
