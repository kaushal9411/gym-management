import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  row: null as { isEnabled: boolean; config: unknown } | null,
  findCalls: 0,
  envRazorpay: { keyId: undefined as string | undefined, keySecret: undefined as string | undefined, webhookSecret: undefined as string | undefined },
}));

vi.mock('../../../config/env', () => ({
  env: {
    get razorpay() {
      return state.envRazorpay;
    },
  },
}));
vi.mock('../../../core/logging/logger', () => ({ logger: { warn: () => undefined } }));
vi.mock('../../../infrastructure/database/prisma', () => ({
  prisma: {
    paymentGateway: {
      findUnique: async () => {
        state.findCalls += 1;
        return state.row;
      },
    },
  },
}));
vi.mock('../../../core/security/encryption.util', () => ({
  encryptSecret: (plain: string) => `enc(${plain})`,
  decryptSecret: (stored: string) => {
    if (!stored.startsWith('enc(')) throw new Error('bad ciphertext');
    return stored.slice(4, -1);
  },
}));

import {
  getRazorpayConfig,
  getRazorpayKeyId,
  invalidateRazorpayConfigCache,
  isRazorpayConfigured,
  razorpayModeFromKeyId,
  resolveRazorpayConfigFromRow,
} from './razorpay-config.service';

const dbRow = (overrides: Partial<{ isEnabled: boolean; config: unknown }> = {}) => ({
  isEnabled: true,
  config: { keyId: 'rzp_test_dbkey123', keySecretEnc: 'enc(db-secret-value)', webhookSecretEnc: 'enc(db-webhook-secret)' },
  ...overrides,
});

describe('razorpay config resolver', () => {
  beforeEach(() => {
    state.row = null;
    state.findCalls = 0;
    state.envRazorpay = { keyId: 'rzp_test_envkey123', keySecret: 'env-secret-value', webhookSecret: 'env-webhook-secret' };
    invalidateRazorpayConfigCache();
  });

  it('prefers the enabled database row over the environment', async () => {
    state.row = dbRow();
    expect(await getRazorpayConfig()).toEqual({
      keyId: 'rzp_test_dbkey123',
      keySecret: 'db-secret-value',
      webhookSecret: 'db-webhook-secret',
      source: 'database',
    });
  });

  it('falls back to the environment when there is no row', async () => {
    expect(await getRazorpayConfig()).toEqual({
      keyId: 'rzp_test_envkey123',
      keySecret: 'env-secret-value',
      webhookSecret: 'env-webhook-secret',
      source: 'environment',
    });
  });

  it('ignores a disabled row', async () => {
    state.row = dbRow({ isEnabled: false });
    expect((await getRazorpayConfig()).source).toBe('environment');
  });

  it('ignores an incomplete row (no secret stored)', async () => {
    state.row = dbRow({ config: { keyId: 'rzp_test_dbkey123' } });
    expect((await getRazorpayConfig()).source).toBe('environment');
  });

  it('falls back to the environment when stored secrets cannot be decrypted', () => {
    const config = resolveRazorpayConfigFromRow(dbRow({ config: { keyId: 'rzp_test_dbkey123', keySecretEnc: 'garbage' } }));
    expect(config.source).toBe('environment');
  });

  it('reports source none when neither the row nor the environment has keys', async () => {
    state.envRazorpay = { keyId: undefined, keySecret: undefined, webhookSecret: undefined };
    expect(await getRazorpayConfig()).toEqual({ keyId: null, keySecret: null, webhookSecret: null, source: 'none' });
    expect(await isRazorpayConfigured()).toBe(false);
    expect(await getRazorpayKeyId()).toBeNull();
  });

  it('does not mix a database key with the environment webhook secret', async () => {
    state.row = dbRow({ config: { keyId: 'rzp_test_dbkey123', keySecretEnc: 'enc(db-secret-value)' } });
    expect((await getRazorpayConfig()).webhookSecret).toBeNull();
  });

  it('caches for the TTL and re-reads after invalidation', async () => {
    state.row = dbRow();
    await getRazorpayConfig();
    await getRazorpayConfig();
    expect(state.findCalls).toBe(1);

    state.row = null;
    expect((await getRazorpayConfig()).source).toBe('database'); // still the cached value
    invalidateRazorpayConfigCache();
    expect((await getRazorpayConfig()).source).toBe('environment');
    expect(state.findCalls).toBe(2);
  });

  it('exposes configured/keyId helpers from the resolved config', async () => {
    state.row = dbRow();
    expect(await isRazorpayConfigured()).toBe(true);
    expect(await getRazorpayKeyId()).toBe('rzp_test_dbkey123');
  });

  it('derives the mode from the key id prefix', () => {
    expect(razorpayModeFromKeyId('rzp_test_abcdef')).toBe('test');
    expect(razorpayModeFromKeyId('rzp_live_abcdef')).toBe('live');
    expect(razorpayModeFromKeyId('nonsense')).toBeNull();
    expect(razorpayModeFromKeyId(null)).toBeNull();
  });
});
