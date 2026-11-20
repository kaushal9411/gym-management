import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  users: [] as unknown[],
  credentials: [] as unknown[],
}));

vi.mock('../../../infrastructure/database/prisma', () => ({
  prisma: {
    user: { findMany: vi.fn(async () => state.users) },
    memberCredential: { findMany: vi.fn(async () => state.credentials) },
  },
}));

vi.mock('../../../core/security/password.service', () => ({
  passwordService: { verify: vi.fn(async (plain: string, hash: string) => hash === `hash:${plain}`) },
}));

import { gymDiscoveryService } from './gym-discovery.service';

const tenant = (slug: string, overrides: Record<string, unknown> = {}) => ({
  slug,
  name: slug.toUpperCase(),
  status: 'ACTIVE',
  maintenanceMode: false,
  deletedAt: null,
  branding: null,
  ...overrides,
});

describe('GymDiscoveryService', () => {
  beforeEach(() => {
    state.users = [];
    state.credentials = [];
  });

  it('returns only the gyms where the password verifies', async () => {
    state.users = [
      { passwordHash: 'hash:secret', tenant: tenant('beta') },
      { passwordHash: 'hash:other', tenant: tenant('alpha') },
      { passwordHash: 'hash:secret', tenant: tenant('alpha') },
    ];
    const gyms = await gymDiscoveryService.discover({ actorType: 'staff', identifier: 'A@B.com', password: 'secret' });
    expect(gyms.map((g) => g.slug)).toEqual(['alpha', 'beta']);
  });

  it('drops gyms a login could not succeed against', async () => {
    state.users = [
      { passwordHash: 'hash:secret', tenant: tenant('live') },
      { passwordHash: 'hash:secret', tenant: tenant('suspended', { status: 'SUSPENDED' }) },
      { passwordHash: 'hash:secret', tenant: tenant('maintenance', { maintenanceMode: true }) },
      { passwordHash: 'hash:secret', tenant: tenant('deleted', { deletedAt: new Date() }) },
    ];
    const gyms = await gymDiscoveryService.discover({ actorType: 'staff', identifier: 'a@b.com', password: 'secret' });
    expect(gyms.map((g) => g.slug)).toEqual(['live']);
  });

  it('rejects with INVALID_CREDENTIALS when nothing matches (staff and member wording)', async () => {
    await expect(gymDiscoveryService.discover({ actorType: 'staff', identifier: 'a@b.com', password: 'x' })).rejects.toMatchObject({
      httpStatus: 401,
      message: 'Incorrect email or password',
    });
    await expect(gymDiscoveryService.discover({ actorType: 'member', identifier: 'MEM-1', password: 'x' })).rejects.toMatchObject({
      httpStatus: 401,
      message: 'Incorrect member ID or password',
    });
  });

  it('searches the member credential plane for member logins', async () => {
    state.credentials = [{ passwordHash: 'hash:pw', tenant: tenant('gym-one', { branding: { logoUrl: 'https://x/logo.png' } }) }];
    const gyms = await gymDiscoveryService.discover({ actorType: 'member', identifier: 'MEM-0001', password: 'pw' });
    expect(gyms).toEqual([{ slug: 'gym-one', name: 'GYM-ONE', logoUrl: 'https://x/logo.png' }]);
  });
});
