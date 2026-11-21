import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  cached: null as unknown,
  row: null as { value: unknown } | null,
  throwOnRead: false,
  stored: null as unknown,
}));

vi.mock('../../../infrastructure/cache/redis', () => ({
  cache: {
    get: vi.fn(async () => state.cached),
    set: vi.fn(async (_k: string, v: unknown) => void (state.stored = v)),
    del: vi.fn(),
  },
}));
vi.mock('../../../infrastructure/database/prisma', () => ({
  prisma: {
    systemSetting: {
      findUnique: vi.fn(async () => {
        if (state.throwOnRead) throw new Error('db down');
        return state.row;
      }),
    },
  },
}));

import { getPlatformMaintenance } from './platform-maintenance.service';

describe('getPlatformMaintenance', () => {
  beforeEach(() => {
    state.cached = null;
    state.row = null;
    state.throwOnRead = false;
    state.stored = null;
  });

  it('is off when the setting was never saved', async () => {
    expect(await getPlatformMaintenance()).toEqual({ enabled: false, message: null });
  });

  it('is on with a trimmed message when enabled', async () => {
    state.row = { value: { enabled: true, message: 'TEST ' } };
    expect(await getPlatformMaintenance()).toEqual({ enabled: true, message: 'TEST' });
    expect(state.stored).toEqual({ enabled: true, message: 'TEST' });
  });

  it('is on with no message when the message is blank', async () => {
    state.row = { value: { enabled: true, message: '   ' } };
    expect(await getPlatformMaintenance()).toEqual({ enabled: true, message: null });
  });

  it('is off when enabled is anything but true', async () => {
    state.row = { value: { enabled: 'true', message: 'x' } };
    expect((await getPlatformMaintenance()).enabled).toBe(false);
  });

  it('uses the cached answer without touching the database', async () => {
    state.cached = { enabled: true, message: 'cached' };
    expect(await getPlatformMaintenance()).toEqual({ enabled: true, message: 'cached' });
  });

  it('never takes the platform down when the setting cannot be read', async () => {
    state.throwOnRead = true;
    expect(await getPlatformMaintenance()).toEqual({ enabled: false, message: null });
  });
});
