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
  twilioAccountSid: string | null;
  hasTwilioAuthToken: boolean;
  twilioAuthTokenMasked: string | null;
  twilioSmsFromNumber: string | null;
  twilioWhatsappFromNumber: string | null;
  /** Whether Twilio is actually usable right now — this row's fields, or the `.env` fallback, combined. */
  twilioConfigured: boolean;
}

export interface UpdatePlatformNotificationCredentialInput {
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  /** Omitted = leave the existing password untouched; `''` = clear it (fall back to `.env`); anything else = replace it. */
  smtpPassword?: string;
  smtpFromName?: string;
  smtpFromAddress?: string;
  twilioAccountSid?: string;
  twilioAuthToken?: string;
  twilioSmsFromNumber?: string;
  twilioWhatsappFromNumber?: string;
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

export interface ResolvedTwilioConfig {
  accountSid: string;
  authToken: string;
  smsFromNumber?: string;
  whatsappFromNumber?: string;
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
 * per-tenant. `resolveSmtpConfig`/`resolveTwilioConfig` are the only methods
 * that ever decrypt anything, and only when a real send is about to happen
 * (`mailer.ts`/`infrastructure/sms/twilio.client.ts`) — never cached past
 * that one call, so an admin's credential update takes effect on the very
 * next send with no restart/cache-invalidation needed.
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
      twilioAccountSid: row?.twilioAccountSid ?? null,
      hasTwilioAuthToken: Boolean(row?.twilioAuthTokenEncrypted),
      twilioAuthTokenMasked: row?.twilioAuthTokenEncrypted ? this.safeMask(row.twilioAuthTokenEncrypted) : null,
      twilioSmsFromNumber: row?.twilioSmsFromNumber ?? null,
      twilioWhatsappFromNumber: row?.twilioWhatsappFromNumber ?? null,
      twilioConfigured: Boolean((row?.twilioAccountSid ?? env.twilio.accountSid) && (row?.twilioAuthTokenEncrypted ? true : env.twilio.authToken)),
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
      twilioAccountSid: stringField(input.twilioAccountSid),
      twilioSmsFromNumber: stringField(input.twilioSmsFromNumber),
      twilioWhatsappFromNumber: stringField(input.twilioWhatsappFromNumber),
      updatedBy: adminUserId,
    };
    if (input.smtpPassword !== undefined) {
      data.smtpPasswordEncrypted = input.smtpPassword === '' ? null : encryptSecret(input.smtpPassword);
    }
    if (input.twilioAuthToken !== undefined) {
      data.twilioAuthTokenEncrypted = input.twilioAuthToken === '' ? null : encryptSecret(input.twilioAuthToken);
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

  /** Throws when Twilio isn't configured anywhere (DB row nor `.env`) — `twilio.client.ts` catches this and no-ops, same "never required to boot" pattern as every other optional integration. */
  async resolveTwilioConfig(): Promise<ResolvedTwilioConfig> {
    const row = await this.findRow();
    const accountSid = row?.twilioAccountSid ?? env.twilio.accountSid;
    const authToken = row?.twilioAuthTokenEncrypted ? decryptSecret(row.twilioAuthTokenEncrypted) : env.twilio.authToken;
    if (!accountSid || !authToken) throw new Error('Twilio is not configured.');
    return {
      accountSid,
      authToken,
      smsFromNumber: row?.twilioSmsFromNumber ?? env.twilio.smsFromNumber,
      whatsappFromNumber: row?.twilioWhatsappFromNumber ?? env.twilio.whatsappFromNumber,
    };
  }
}

export const platformNotificationCredentialService = new PlatformNotificationCredentialService();
