import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ store: new Map<string, unknown>(), rows: new Map<string, unknown>() }));

vi.mock('../../../infrastructure/cache/redis', () => ({
  cache: {
    get: vi.fn(async (k: string) => state.store.get(k) ?? null),
    set: vi.fn(async (k: string, v: unknown) => void state.store.set(k, v)),
    del: vi.fn(),
  },
}));
vi.mock('../../../infrastructure/database/prisma', () => ({
  prisma: { systemSetting: { findUnique: vi.fn(async ({ where }: { where: { key: string } }) => (state.rows.has(where.key) ? { value: state.rows.get(where.key) } : null)) } },
}));

import { getCompanyInfo, getPlatformBranding } from './platform-config.service';

describe('company information → platform email branding', () => {
  beforeEach(() => {
    state.store.clear();
    state.rows.clear();
  });

  it('adds the saved support email to platform branding', async () => {
    state.rows.set('company_info', { name: ' FitCloud Inc. ', supportEmail: 'support@example.com', website: 'https://example.com' });
    expect(await getCompanyInfo()).toEqual({ name: 'FitCloud Inc.', supportEmail: 'support@example.com', website: 'https://example.com' });
    expect(await getPlatformBranding()).toMatchObject({ isPlatform: true, supportEmail: 'support@example.com' });
  });

  it('ignores an invalid support email rather than printing it in every email', async () => {
    state.rows.set('company_info', { supportEmail: 'not-an-email' });
    expect((await getCompanyInfo()).supportEmail).toBeNull();
    expect(await getPlatformBranding()).not.toHaveProperty('supportEmail');
  });

  it('has no support email when nothing was saved', async () => {
    expect(await getPlatformBranding()).not.toHaveProperty('supportEmail');
  });
});
