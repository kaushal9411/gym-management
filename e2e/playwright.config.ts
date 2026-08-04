import { defineConfig } from '@playwright/test';

/**
 * Root-level, shared across both frontend apps — not per-app, since
 * accessibility specs here compare tenant-web against super-admin rather
 * than testing one app's business logic. Points at whatever's already
 * running (`pnpm dev` locally, or the CI job's own background-started
 * servers) rather than owning `webServer` lifecycle itself — this repo's
 * apps need a live API + seeded DB behind them, which a single Playwright
 * `webServer` block can't orchestrate cleanly for two Next.js apps at once.
 */
export default defineConfig({
  testDir: '.',
  timeout: 30_000,
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['github']] : 'list',
  use: {
    screenshot: 'only-on-failure',
  },
});
