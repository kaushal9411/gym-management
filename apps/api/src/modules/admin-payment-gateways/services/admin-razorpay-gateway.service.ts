import type { Prisma } from '@prisma/client';

import { env } from '../../../config/env';
import { ValidationError } from '../../../core/errors/app-error';
import { decryptSecret, encryptSecret } from '../../../core/security/encryption.util';
import { prisma } from '../../../infrastructure/database/prisma';
import { adminAuditLogRepository } from '../../admin-audit/repositories/admin-audit-log.repository';
import type { TestRazorpayGatewayInput, UpsertRazorpayGatewayInput } from '../validators/admin-payment-gateways.validators';

import {
  invalidateRazorpayConfigCache,
  loadRazorpayConfig,
  razorpayModeFromKeyId,
  readStoredConfig,
  resolveRazorpayConfigFromRow,
  type RazorpayConfigSource,
  type RazorpayStoredConfig,
} from './razorpay-config.service';

export interface RazorpayGatewayView {
  provider: 'RAZORPAY';
  source: RazorpayConfigSource;
  configured: boolean;
  isEnabled: boolean;
  mode: 'test' | 'live' | null;
  keyId: string | null;
  keySecretSet: boolean;
  keySecretLast4: string | null;
  webhookSecretSet: boolean;
  webhookUrl: string;
  updatedAt: string | null;
}

export interface RazorpayTestResult {
  ok: boolean;
  mode: 'test' | 'live' | null;
  message: string;
}

const RAZORPAY_PROBE_URL = 'https://api.razorpay.com/v1/payments?count=1';
const PROBE_TIMEOUT_MS = 8_000;

/** Full public URL of the real Razorpay webhook receiver (mounted in `api/v1/router.ts`). */
export function razorpayWebhookUrl(): string {
  return `${env.publicUrl.replace(/\/+$/, '')}/api/${env.apiVersion}/webhook/razorpay-payment-link`;
}

function last4(encrypted: string | undefined): string | null {
  if (!encrypted) return null;
  try {
    return decryptSecret(encrypted).slice(-4);
  } catch {
    return null;
  }
}

/** Audit-safe snapshot — identifiers and flags only, NEVER a secret (not even the encrypted blob). */
function auditSnapshot(row: { isEnabled: boolean; config: unknown } | null) {
  if (!row) return null;
  const stored = readStoredConfig(row.config);
  return {
    isEnabled: row.isEnabled,
    keyId: stored.keyId ?? null,
    mode: razorpayModeFromKeyId(stored.keyId),
    keySecretSet: Boolean(stored.keySecretEnc),
    webhookSecretSet: Boolean(stored.webhookSecretEnc),
  };
}

/**
 * Super-admin management of the Razorpay credentials stored in the existing
 * `payment_gateways` row (`provider = RAZORPAY`, `config` JSON). Secrets are
 * encrypted at rest and NEVER returned — only `keySecretSet`/`keySecretLast4`.
 * The values actually used by the API come from `getRazorpayConfig()` (enabled
 * DB row wins, `env.razorpay.*` otherwise); every write here invalidates its
 * cache so a change takes effect immediately.
 */
export class AdminRazorpayGatewayService {
  private findRow() {
    return prisma.paymentGateway.findUnique({ where: { provider: 'RAZORPAY' } });
  }

  async getView(): Promise<RazorpayGatewayView> {
    const row = await this.findRow();
    const effective = resolveRazorpayConfigFromRow(row);
    const base = { provider: 'RAZORPAY' as const, source: effective.source, configured: effective.source !== 'none', webhookUrl: razorpayWebhookUrl() };

    if (row) {
      const stored = readStoredConfig(row.config);
      return {
        ...base,
        isEnabled: row.isEnabled,
        mode: razorpayModeFromKeyId(stored.keyId),
        keyId: stored.keyId ?? null,
        keySecretSet: Boolean(stored.keySecretEnc),
        keySecretLast4: last4(stored.keySecretEnc),
        webhookSecretSet: Boolean(stored.webhookSecretEnc),
        updatedAt: row.updatedAt.toISOString(),
      };
    }

    return {
      ...base,
      isEnabled: base.configured,
      mode: razorpayModeFromKeyId(env.razorpay.keyId),
      keyId: env.razorpay.keyId ?? null,
      keySecretSet: Boolean(env.razorpay.keySecret),
      keySecretLast4: env.razorpay.keySecret ? env.razorpay.keySecret.slice(-4) : null,
      webhookSecretSet: Boolean(env.razorpay.webhookSecret),
      updatedAt: null,
    };
  }

  async upsert(input: UpsertRazorpayGatewayInput, adminUserId: string, adminRole: string): Promise<RazorpayGatewayView> {
    const existing = await this.findRow();
    const stored = readStoredConfig(existing?.config);

    if (!input.keySecret && !stored.keySecretEnc) {
      throw new ValidationError('Request validation failed', { keySecret: ['Key secret is required the first time credentials are saved'] });
    }
    if (!input.keySecret && razorpayModeFromKeyId(stored.keyId) !== razorpayModeFromKeyId(input.keyId)) {
      throw new ValidationError('Request validation failed', { keySecret: ['Enter the key secret again when switching between test and live keys'] });
    }

    const config: RazorpayStoredConfig = {
      keyId: input.keyId,
      keySecretEnc: input.keySecret ? encryptSecret(input.keySecret) : stored.keySecretEnc,
      webhookSecretEnc: input.webhookSecret ? encryptSecret(input.webhookSecret) : stored.webhookSecretEnc,
    };
    // JSON column: drop undefined members so Prisma doesn't choke on them.
    const configJson = JSON.parse(JSON.stringify(config)) as Prisma.InputJsonObject;
    const isEnabled = input.isEnabled ?? existing?.isEnabled ?? true;

    const saved = await prisma.paymentGateway.upsert({
      where: { provider: 'RAZORPAY' },
      create: { provider: 'RAZORPAY', isEnabled, config: configJson },
      update: { isEnabled, config: configJson },
    });
    invalidateRazorpayConfigCache();

    await adminAuditLogRepository.record({
      adminUserId,
      actorRole: adminRole,
      action: 'admin.razorpay_credentials_updated',
      entityType: 'PaymentGateway',
      entityId: saved.id,
      before: auditSnapshot(existing),
      after: { ...auditSnapshot(saved), keySecretChanged: Boolean(input.keySecret), webhookSecretChanged: Boolean(input.webhookSecret) },
    });
    return this.getView();
  }

  async remove(adminUserId: string, adminRole: string): Promise<RazorpayGatewayView> {
    const existing = await this.findRow();
    if (existing) {
      await prisma.paymentGateway.delete({ where: { id: existing.id } });
      invalidateRazorpayConfigCache();
      await adminAuditLogRepository.record({
        adminUserId,
        actorRole: adminRole,
        action: 'admin.razorpay_credentials_removed',
        entityType: 'PaymentGateway',
        entityId: existing.id,
        before: auditSnapshot(existing),
      });
    }
    return this.getView();
  }

  /** READ-ONLY probe against Razorpay (`GET /v1/payments?count=1`). Never throws for bad credentials or network trouble. */
  async testConnection(input: TestRazorpayGatewayInput): Promise<RazorpayTestResult> {
    const current = await loadRazorpayConfig();
    const keyId = input.keyId ?? current.keyId;
    const keySecret = input.keySecret ?? current.keySecret;
    const mode = razorpayModeFromKeyId(keyId);
    if (!keyId || !keySecret) {
      return { ok: false, mode, message: 'No Razorpay credentials to test. Enter a Key ID and Key secret first.' };
    }

    try {
      const response = await fetch(RAZORPAY_PROBE_URL, {
        headers: { Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}` },
        signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      });
      if (response.ok) {
        return { ok: true, mode, message: `Connected to Razorpay${mode ? ` in ${mode} mode` : ''}.` };
      }
      if (response.status === 401) {
        return { ok: false, mode, message: 'Razorpay rejected these credentials.' };
      }
      return { ok: false, mode, message: `Razorpay responded with an unexpected status (${response.status}). Try again shortly.` };
    } catch {
      return { ok: false, mode, message: 'Could not reach Razorpay. Check the server internet connection and try again.' };
    }
  }
}

export const adminRazorpayGatewayService = new AdminRazorpayGatewayService();
