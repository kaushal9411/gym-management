/**
 * Shared ESLint preset — extended by every TypeScript workspace via
 * `"extends": ["@gym-saas/eslint-config"]`. Rules follow
 * docs/coding-guidelines/CODING-STANDARDS.md (no `any`, no floating
 * promises, no console outside the logger module).
 */
module.exports = {
  parser: '@typescript-eslint/parser',
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
    'no-console': ['error', { allow: [] }],
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
