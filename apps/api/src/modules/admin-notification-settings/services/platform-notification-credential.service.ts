import type { Prisma } from '@prisma/client';

import { env } from '../../../config/env';
import { decryptSecret, encryptSecret, maskSecret } from '../../../core/security/encryption.util';
import { prisma } from '../../../infrastructure/database/prisma';
import { adminAuditLogRepository } from '../../admin-audit/repositories/admin-audit-log.repository';

export interface PlatformNotificationCredentialView {
  smtpHost: string | null;
  smtpPort: number | null;
  smtpUser: string | null;
  hasSmtpPassword: boolean;
  smtpPasswordMasked: string | null;
  smtpFromName: string | null;
  smtpFromAddress: string | null;
  kaleyraSid: string | null;
  hasKaleyraApiKey: boolean;
  kaleyraApiKeyMasked: string | null;
  kaleyraApiDomain: string | null;
  kaleyraSmsSenderId: string | null;
  kaleyraWhatsappNumber: string | null;
  /** Whether Kaleyra is actually usable right now — this row's fields, or the `.env` fallback, combined. */
  kaleyraConfigured: boolean;
}

export interface UpdatePlatformNotificationCredentialInput {
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  /** Omitted = leave the existing password untouched; `''` = clear it (fall back to `.env`); anything else = replace it. */
  smtpPassword?: string;
  smtpFromName?: string;
  smtpFromAddress?: string;
  kaleyraSid?: string;
  kaleyraApiKey?: string;
  kaleyraApiDomain?: string;
  kaleyraSmsSenderId?: string;
  kaleyraWhatsappNumber?: string;
}

export interface ResolvedSmtpConfig {
  host: string;
  port: number;
  user?: string;
  pass?: string;
  secure: boolean;
  fromName: string;
  fromAddress: string;
}

export interface ResolvedMessagingConfig {
  sid: string;
  apiKey: string;
  apiDomain: string;
  smsSenderId?: string;
  whatsappNumber?: string;
}

/** `''` clears a string field back to "use the `.env` fallback" (`null`); `undefined` (not present in the request) leaves it untouched. */
function stringField(value: string | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  return value === '' ? null : value;
}

/**
 * Singleton — at most one row ever exists (`findFirst`, no unique key to
 * upsert against since there's no natural one for a true singleton). Secrets
 * follow `TenantAiSettings`'s exact encrypt-on-write/decrypt-only-at-send
 * shape (`core/security/encryption.util.ts`), just platform-wide instead of
 * per-tenant. `resolveSmtpConfig`/`resolveMessagingConfig` are the only
 * methods that ever decrypt anything, and only when a real send is about to
 * happen (`mailer.ts`/`infrastructure/sms/kaleyra.client.ts`) — never cached
 * past that one call, so an admin's credential update takes effect on the
 * very next send with no restart/cache-invalidation needed.
 */
export class PlatformNotificationCredentialService {
  private async findRow() {
    return prisma.platformNotificationCredential.findFirst();
  }

  async getView(): Promise<PlatformNotificationCredentialView> {
    const row = await this.findRow();

    return {
      smtpHost: row?.smtpHost ?? null,
      smtpPort: row?.smtpPort ?? null,
      smtpUser: row?.smtpUser ?? null,
      hasSmtpPassword: Boolean(row?.smtpPasswordEncrypted),
      smtpPasswordMasked: row?.smtpPasswordEncrypted ? this.safeMask(row.smtpPasswordEncrypted) : null,
      smtpFromName: row?.smtpFromName ?? null,
      smtpFromAddress: row?.smtpFromAddress ?? null,
      kaleyraSid: row?.kaleyraSid ?? null,
      hasKaleyraApiKey: Boolean(row?.kaleyraApiKeyEncrypted),
      kaleyraApiKeyMasked: row?.kaleyraApiKeyEncrypted ? this.safeMask(row.kaleyraApiKeyEncrypted) : null,
      kaleyraApiDomain: row?.kaleyraApiDomain ?? null,
      kaleyraSmsSenderId: row?.kaleyraSmsSenderId ?? null,
      kaleyraWhatsappNumber: row?.kaleyraWhatsappNumber ?? null,
      kaleyraConfigured: Boolean(
        (row?.kaleyraSid ?? env.kaleyra.sid) &&
          (row?.kaleyraApiKeyEncrypted ? true : env.kaleyra.apiKey) &&
          (row?.kaleyraApiDomain ?? env.kaleyra.apiDomain),
      ),
    };
  }

  async update(input: UpdatePlatformNotificationCredentialInput, adminUserId: string, adminRole: string): Promise<PlatformNotificationCredentialView> {
    const existing = await this.findRow();

    const data: Prisma.PlatformNotificationCredentialUncheckedUpdateInput = {
      smtpHost: stringField(input.smtpHost),
      smtpPort: input.smtpPort,
      smtpUser: stringField(input.smtpUser),
      smtpFromName: stringField(input.smtpFromName),
      smtpFromAddress: stringField(input.smtpFromAddress),
      kaleyraSid: stringField(input.kaleyraSid),
      kaleyraApiDomain: stringField(input.kaleyraApiDomain),
      kaleyraSmsSenderId: stringField(input.kaleyraSmsSenderId),
      kaleyraWhatsappNumber: stringField(input.kaleyraWhatsappNumber),
      updatedBy: adminUserId,
    };
    if (input.smtpPassword !== undefined) {
      data.smtpPasswordEncrypted = input.smtpPassword === '' ? null : encryptSecret(input.smtpPassword);
    }
    if (input.kaleyraApiKey !== undefined) {
      data.kaleyraApiKeyEncrypted = input.kaleyraApiKey === '' ? null : encryptSecret(input.kaleyraApiKey);
    }

    if (existing) {
      await prisma.platformNotificationCredential.update({ where: { id: existing.id }, data });
    } else {
      await prisma.platformNotificationCredential.create({ data: data as Prisma.PlatformNotificationCredentialUncheckedCreateInput });
    }

    await adminAuditLogRepository.record({
      adminUserId,
      actorRole: adminRole,
      action: 'admin.notification_credentials_updated',
      entityType: 'PlatformNotificationCredential',
      entityId: existing?.id ?? 'new',
    });
    return this.getView();
  }

  private safeMask(encrypted: string): string {
    try {
      return maskSecret(decryptSecret(encrypted));
    } catch {
      return '••••'; // a decrypt failure (e.g. ENCRYPTION_KEY rotated) shouldn't break the settings page
    }
  }

  async resolveSmtpConfig(): Promise<ResolvedSmtpConfig> {
    const row = await this.findRow();
    return {
      host: row?.smtpHost ?? env.mail.host,
      port: row?.smtpPort ?? env.mail.port,
      user: row?.smtpUser ?? env.mail.user,
      pass: row?.smtpPasswordEncrypted ? decryptSecret(row.smtpPasswordEncrypted) : env.mail.pass,
      // TLS mode isn't admin-editable — it rarely changes independently of host/port, kept env-only to limit scope.
      secure: env.mail.secure,
      fromName: row?.smtpFromName ?? env.mail.fromName,
      fromAddress: row?.smtpFromAddress ?? env.mail.fromAddress,
    };
  }

  /** Throws when Kaleyra isn't configured anywhere (DB row nor `.env`) — `kaleyra.client.ts` catches this and no-ops, same "never required to boot" pattern as every other optional integration. */
  async resolveMessagingConfig(): Promise<ResolvedMessagingConfig> {
    const row = await this.findRow();
    const sid = row?.kaleyraSid ?? env.kaleyra.sid;
    const apiKey = row?.kaleyraApiKeyEncrypted ? decryptSecret(row.kaleyraApiKeyEncrypted) : env.kaleyra.apiKey;
    const apiDomain = row?.kaleyraApiDomain ?? env.kaleyra.apiDomain;
    if (!sid || !apiKey || !apiDomain) throw new Error('Kaleyra is not configured.');
    return {
      sid,
      apiKey,
      apiDomain,
      smsSenderId: row?.kaleyraSmsSenderId ?? env.kaleyra.smsSenderId,
      whatsappNumber: row?.kaleyraWhatsappNumber ?? env.kaleyra.whatsappNumber,
    };
  }
}

export const platformNotificationCredentialService = new PlatformNotificationCredentialService();
