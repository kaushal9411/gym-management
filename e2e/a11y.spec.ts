import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

/**
 * Real axe-core scans against real rendered pages — a different, broader
 * check than `eslint-plugin-jsx-a11y` (which only sees the JSX source, not
 * the computed DOM/ARIA tree, color contrast, duplicate ids, landmark
 * structure, etc.). Scoped to unauthenticated pages on purpose: this repo
 * has no seeded-auth-state fixture yet, and these are the two pages every
 * real user hits before anything else, so they're the highest-value place
 * to start.
 */
const TARGETS = [
  { app: 'tenant-web', url: process.env.TENANT_WEB_URL ?? 'http://localhost:3001/login' },
  { app: 'super-admin', url: process.env.SUPER_ADMIN_URL ?? 'http://localhost:3002/login' },
];

for (const { app, url } of TARGETS) {
  test(`${app} login page has no serious/critical accessibility violations`, async ({ page }) => {
    await page.goto(url, { waitUntil: 'networkidle' });

    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    const seriousOrWorse = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');

    if (seriousOrWorse.length > 0) {
      const summary = seriousOrWorse.map((v) => `- [${v.impact}] ${v.id}: ${v.help} (${v.nodes.length} node(s))`).join('\n');
      throw new Error(`${app}'s login page has ${seriousOrWorse.length} serious/critical accessibility violation(s):\n${summary}`);
    }

    expect(seriousOrWorse).toHaveLength(0);
  });
}
