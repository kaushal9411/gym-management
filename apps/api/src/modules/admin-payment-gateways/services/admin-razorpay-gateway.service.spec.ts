import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

interface Row {
  id: string;
  provider: 'RAZORPAY';
  isEnabled: boolean;
  config: Record<string, string>;
  updatedAt: Date;
}

interface UpsertData {
  isEnabled: boolean;
  config: Record<string, string>;
}

const state = vi.hoisted(() => ({
  row: null as Row | null,
  audits: [] as Array<Record<string, unknown>>,
  envRazorpay: { keyId: undefined as string | undefined, keySecret: undefined as string | undefined, webhookSecret: undefined as string | undefined },
}));

vi.mock('../../../config/env', () => ({
  env: {
    publicUrl: 'https://api.example.com/',
    apiVersion: 'v1',
    get razorpay() {
      return state.envRazorpay;
    },
  },
}));
vi.mock('../../../core/logging/logger', () => ({ logger: { warn: () => undefined } }));
vi.mock('../../../infrastructure/database/prisma', () => ({
  prisma: {
    paymentGateway: {
      findUnique: async () => state.row,
      upsert: async (args: { create: UpsertData; update: UpsertData }) => {
        const data = state.row ? args.update : args.create;
        state.row = { id: 'gw-1', provider: 'RAZORPAY', isEnabled: data.isEnabled, config: data.config, updatedAt: new Date('2026-01-01T00:00:00Z') };
        return state.row;
      },
      delete: async () => {
        state.row = null;
      },
    },
  },
}));
vi.mock('../../admin-audit/repositories/admin-audit-log.repository', () => ({
  adminAuditLogRepository: {
    record: async (input: Record<string, unknown>) => {
      state.audits.push(input);
    },
  },
}));
vi.mock('../../../core/security/encryption.util', () => ({
  encryptSecret: (plain: string) => `enc(${plain})`,
  decryptSecret: (stored: string) => stored.slice(4, -1),
}));

import { AdminRazorpayGatewayService } from './admin-razorpay-gateway.service';
import { getRazorpayConfig, invalidateRazorpayConfigCache } from './razorpay-config.service';

const KEY_SECRET = 'super-secret-key-9999';
const WEBHOOK_SECRET = 'webhook-secret-abc';

describe('AdminRazorpayGatewayService', () => {
  const service = new AdminRazorpayGatewayService();

  beforeEach(() => {
    state.row = null;
    state.audits = [];
    state.envRazorpay = { keyId: undefined, keySecret: undefined, webhookSecret: undefined };
    invalidateRazorpayConfigCache();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('reports source none and the webhook url when nothing is configured', async () => {
    const view = await service.getView();
    expect(view).toMatchObject({
      provider: 'RAZORPAY',
      source: 'none',
      configured: false,
      keyId: null,
      keySecretSet: false,
      keySecretLast4: null,
      mode: null,
      updatedAt: null,
      webhookUrl: 'https://api.example.com/api/v1/webhook/razorpay-payment-link',
    });
  });

  it('reports environment credentials without exposing the secrets', async () => {
    state.envRazorpay = { keyId: 'rzp_live_envkey123', keySecret: 'env-secret-value', webhookSecret: 'env-webhook-secret' };
    const view = await service.getView();
    expect(view).toMatchObject({
      source: 'environment',
      configured: true,
      mode: 'live',
      keyId: 'rzp_live_envkey123',
      keySecretSet: true,
      keySecretLast4: 'alue',
      webhookSecretSet: true,
    });
    expect(JSON.stringify(view)).not.toContain('env-secret-value');
    expect(JSON.stringify(view)).not.toContain('env-webhook-secret');
  });

  it('requires the key secret the first time', async () => {
    await expect(service.upsert({ keyId: 'rzp_test_abcdef12' }, 'admin-1', 'SUPER_ADMIN')).rejects.toMatchObject({ httpStatus: 422 });
  });

  it('stores encrypted secrets, switches the resolver to the database and never leaks a secret in the view or audit', async () => {
    const view = await service.upsert({ keyId: 'rzp_test_abcdef12', keySecret: KEY_SECRET, webhookSecret: WEBHOOK_SECRET }, 'admin-1', 'SUPER_ADMIN');

    expect(view).toMatchObject({
      source: 'database',
      configured: true,
      isEnabled: true,
      mode: 'test',
      keyId: 'rzp_test_abcdef12',
      keySecretSet: true,
      keySecretLast4: '9999',
      webhookSecretSet: true,
    });
    expect(state.row?.config.keySecretEnc).toBe(`enc(${KEY_SECRET})`);

    const everything = JSON.stringify({ view, audits: state.audits });
    expect(everything).not.toContain(KEY_SECRET);
    expect(everything).not.toContain(WEBHOOK_SECRET);
    expect(everything).not.toContain('keySecretEnc');
    expect(state.audits).toHaveLength(1);
    expect(state.audits[0]).toMatchObject({ action: 'admin.razorpay_credentials_updated', entityType: 'PaymentGateway' });

    const resolved = await getRazorpayConfig();
    expect(resolved).toMatchObject({ source: 'database', keySecret: KEY_SECRET, webhookSecret: WEBHOOK_SECRET });
  });

  it('keeps the stored secrets when they are omitted on a later save, and honours isEnabled', async () => {
    await service.upsert({ keyId: 'rzp_test_abcdef12', keySecret: KEY_SECRET, webhookSecret: WEBHOOK_SECRET }, 'admin-1', 'SUPER_ADMIN');
    const view = await service.upsert({ keyId: 'rzp_test_other9999', isEnabled: false }, 'admin-1', 'SUPER_ADMIN');

    expect(state.row?.config).toMatchObject({
      keyId: 'rzp_test_other9999',
      keySecretEnc: `enc(${KEY_SECRET})`,
      webhookSecretEnc: `enc(${WEBHOOK_SECRET})`,
    });
    expect(view).toMatchObject({ isEnabled: false, source: 'none', configured: false, keySecretSet: true });
    expect((await getRazorpayConfig()).source).toBe('none'); // disabled row ignored, no env keys
  });

  it('rejects switching between test and live without re-entering the secret', async () => {
    await service.upsert({ keyId: 'rzp_test_abcdef12', keySecret: KEY_SECRET }, 'admin-1', 'SUPER_ADMIN');
    await expect(service.upsert({ keyId: 'rzp_live_abcdef12' }, 'admin-1', 'SUPER_ADMIN')).rejects.toMatchObject({ httpStatus: 422 });
  });

  it('delete removes the row, falls back to env and audits without secrets', async () => {
    state.envRazorpay = { keyId: 'rzp_test_envkey123', keySecret: 'env-secret-value', webhookSecret: undefined };
    await service.upsert({ keyId: 'rzp_test_abcdef12', keySecret: KEY_SECRET }, 'admin-1', 'SUPER_ADMIN');
    const view = await service.remove('admin-1', 'SUPER_ADMIN');

    expect(state.row).toBeNull();
    expect(view).toMatchObject({ source: 'environment', keyId: 'rzp_test_envkey123' });
    expect((await getRazorpayConfig()).source).toBe('environment');
    expect(state.audits.at(-1)).toMatchObject({ action: 'admin.razorpay_credentials_removed' });
    expect(JSON.stringify(state.audits)).not.toContain(KEY_SECRET);
  });

  describe('testConnection', () => {
    it('maps 401 to ok:false without throwing', async () => {
      vi.stubGlobal('fetch', async () => new Response('{}', { status: 401 }));
      const result = await service.testConnection({ keyId: 'rzp_test_abcdef12', keySecret: 'a-very-wrong-secret' });
      expect(result).toEqual({ ok: false, mode: 'test', message: 'Razorpay rejected these credentials.' });
    });

    it('maps a network failure to ok:false', async () => {
      vi.stubGlobal('fetch', async () => {
        throw new Error('ENOTFOUND');
      });
      const result = await service.testConnection({ keyId: 'rzp_live_abcdef12', keySecret: 'a-very-wrong-secret' });
      expect(result.ok).toBe(false);
      expect(result.mode).toBe('live');
      expect(result.message).toContain('Could not reach Razorpay');
    });

    it('returns ok:true on success and falls back to stored values for absent overrides', async () => {
      await service.upsert({ keyId: 'rzp_test_abcdef12', keySecret: KEY_SECRET }, 'admin-1', 'SUPER_ADMIN');
      let auth = '';
      vi.stubGlobal('fetch', async (_url: string, init: { headers: { Authorization: string } }) => {
        auth = init.headers.Authorization;
        return new Response('{}', { status: 200 });
      });
      const result = await service.testConnection({});
      expect(result).toMatchObject({ ok: true, mode: 'test' });
      expect(Buffer.from(auth.replace('Basic ', ''), 'base64').toString()).toBe(`rzp_test_abcdef12:${KEY_SECRET}`);
      expect(JSON.stringify(result)).not.toContain(KEY_SECRET);
    });

    it('reports ok:false when no credentials exist anywhere', async () => {
      const result = await service.testConnection({});
      expect(result.ok).toBe(false);
    });
  });
});
