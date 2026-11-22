// Test config for the feature-flag audit specs in ./tests (tenant-web has no test runner of its own yet).
// Plain object export on purpose: `vitest` is not a dependency of this package, so `defineConfig` can't be imported.
// Run from a shell whose cwd uses an UPPERCASE drive letter (D:...): a lowercase d: cwd makes Node load two copies of React.
// Run with the API workspace's vitest binary from apps/tenant-web:
//   ../api/node_modules/.bin/vitest run
import { fileURLToPath } from 'node:url';

const config = {
  esbuild: { jsx: 'automatic' },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/**/*.spec.{ts,tsx}'],
    testTimeout: 15_000,
  },
};

export default config;
