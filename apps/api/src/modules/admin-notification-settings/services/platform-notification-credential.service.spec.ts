import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  row: null as Record<string, unknown> | null,
  updateCalls: [] as Array<{ where: unknown; data: Record<string, unknown> }>,
  createCalls: [] as Array<Record<string, unknown>>,
  audits: [] as Array<Record<string, unknown>>,
}));

vi.mock('../../../infrastructure/database/prisma', () => ({
  prisma: {
    platformNotificationCredential: {
      findFirst: async () => state.row,
      update: async (args: { where: unknown; data: Record<string, unknown> }) => {
        state.updateCalls.push(args);
        return {};
      },
      create: async (args: { data: Record<string, unknown> }) => {
        state.createCalls.push(args.data);
        return {};
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
  decryptSecret: (stored: string) => stored.replace(/^enc\(/, '').replace(/\)$/, ''),
  maskSecret: (plain: string) => `••••${plain.slice(-4)}`,
}));

import { PlatformNotificationCredentialService } from './platform-notification-credential.service';

describe('PlatformNotificationCredentialService', () => {
  beforeEach(() => {
    state.row = null;
    state.updateCalls = [];
    state.createCalls = [];
    state.audits = [];
  });

  it('getView never returns a plaintext secret — only a masked preview', async () => {
    state.row = { id: 'row-1', kaleyraApiKeyEncrypted: 'enc(sk_live_abcd1234)', smtpPasswordEncrypted: null };
    const service = new PlatformNotificationCredentialService();
    const view = await service.getView();
    expect(view.hasKaleyraApiKey).toBe(true);
    expect(view.kaleyraApiKeyMasked).toBe('••••1234');
    expect(JSON.stringify(view)).not.toContain('sk_live_abcd1234');
    expect(view.hasSmtpPassword).toBe(false);
    expect(view.smtpPasswordMasked).toBeNull();
  });

  it('update encrypts a new secret before persisting it', async () => {
    const service = new PlatformNotificationCredentialService();
    await service.update({ kaleyraApiKey: 'sk_live_newtoken' }, 'admin-1', 'SUPER_ADMIN');
    expect(state.createCalls).toHaveLength(1);
    expect(state.createCalls[0]!.kaleyraApiKeyEncrypted).toBe('enc(sk_live_newtoken)');
  });

  it('update with an empty string clears the secret back to null', async () => {
    state.row = { id: 'row-1', kaleyraApiKeyEncrypted: 'enc(old-token)' };
    const service = new PlatformNotificationCredentialService();
    await service.update({ kaleyraApiKey: '' }, 'admin-1', 'SUPER_ADMIN');
    expect(state.updateCalls).toHaveLength(1);
    expect(state.updateCalls[0]!.data.kaleyraApiKeyEncrypted).toBeNull();
  });

  it('update with the field omitted leaves the existing secret untouched', async () => {
    state.row = { id: 'row-1', kaleyraApiKeyEncrypted: 'enc(old-token)' };
    const service = new PlatformNotificationCredentialService();
    await service.update({ smtpHost: 'smtp.sendgrid.net' }, 'admin-1', 'SUPER_ADMIN');
    expect(state.updateCalls).toHaveLength(1);
    expect(state.updateCalls[0]!.data.kaleyraApiKeyEncrypted).toBeUndefined();
    expect(state.updateCalls[0]!.data.smtpHost).toBe('smtp.sendgrid.net');
  });

  it('records an admin audit entry on every update', async () => {
    const service = new PlatformNotificationCredentialService();
    await service.update({ smtpHost: 'smtp.sendgrid.net' }, 'admin-1', 'SUPER_ADMIN');
    expect(state.audits).toHaveLength(1);
    expect(state.audits[0]).toMatchObject({ adminUserId: 'admin-1', action: 'admin.notification_credentials_updated' });
  });
});
