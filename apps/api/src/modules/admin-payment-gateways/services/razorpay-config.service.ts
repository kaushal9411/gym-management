import { env } from '../../../config/env';
import { logger } from '../../../core/logging/logger';
import { decryptSecret } from '../../../core/security/encryption.util';
import { prisma } from '../../../infrastructure/database/prisma';

export type RazorpayConfigSource = 'database' | 'environment' | 'none';

export interface RazorpayConfig {
  keyId: string | null;
  keySecret: string | null;
  webhookSecret: string | null;
  source: RazorpayConfigSource;
}

/** Shape of `PaymentGateway.config` for the RAZORPAY row — both secrets are AES-256-GCM encrypted (`core/security/encryption.util.ts`). */
export interface RazorpayStoredConfig {
  keyId?: string;
  keySecretEnc?: string;
  webhookSecretEnc?: string;
}

export interface RazorpayGatewayRow {
  isEnabled: boolean;
  config: unknown;
}

const CACHE_TTL_MS = 30_000;

let cached: { value: RazorpayConfig; expiresAt: number } | null = null;

export function readStoredConfig(config: unknown): RazorpayStoredConfig {
  if (!config || typeof config !== 'object' || Array.isArray(config)) return {};
  const c = config as Record<string, unknown>;
  return {
    keyId: typeof c.keyId === 'string' ? c.keyId : undefined,
    keySecretEnc: typeof c.keySecretEnc === 'string' ? c.keySecretEnc : undefined,
    webhookSecretEnc: typeof c.webhookSecretEnc === 'string' ? c.webhookSecretEnc : undefined,
  };
}

export function razorpayModeFromKeyId(keyId: string | null | undefined): 'test' | 'live' | null {
  if (!keyId) return null;
  if (keyId.startsWith('rzp_test_')) return 'test';
  if (keyId.startsWith('rzp_live_')) return 'live';
  return null;
}

function fromEnvironment(): RazorpayConfig {
  if (env.razorpay.keyId && env.razorpay.keySecret) {
    return {
      keyId: env.razorpay.keyId,
      keySecret: env.razorpay.keySecret,
      webhookSecret: env.razorpay.webhookSecret ?? null,
      source: 'environment',
    };
  }
  return { keyId: null, keySecret: null, webhookSecret: null, source: 'none' };
}

/** Pure: resolves the effective config from a (possibly absent) DB row. Enabled + complete row wins; anything else falls back to the environment. */
export function resolveRazorpayConfigFromRow(row: RazorpayGatewayRow | null): RazorpayConfig {
  if (row?.isEnabled) {
    const stored = readStoredConfig(row.config);
    if (stored.keyId && stored.keySecretEnc) {
      try {
        return {
          keyId: stored.keyId,
          keySecret: decryptSecret(stored.keySecretEnc),
          webhookSecret: stored.webhookSecretEnc ? decryptSecret(stored.webhookSecretEnc) : null,
          source: 'database',
        };
      } catch {
        // e.g. ENCRYPTION_KEY rotated — never take payments down over it, fall back to the environment.
        logger.warn('Stored Razorpay credentials could not be decrypted; falling back to environment configuration.');
      }
    }
  }
  return fromEnvironment();
}

/** Uncached read — used by the admin endpoints so the settings page is always truthful. */
export async function loadRazorpayConfig(): Promise<RazorpayConfig> {
  const row = await prisma.paymentGateway.findUnique({ where: { provider: 'RAZORPAY' } });
  return resolveRazorpayConfigFromRow(row);
}

/** The single source of truth for Razorpay credentials: enabled DB row first, `env.razorpay.*` otherwise. Cached ~30s; saves/deletes call `invalidateRazorpayConfigCache()`. */
export async function getRazorpayConfig(): Promise<RazorpayConfig> {
  const now = Date.now();
  if (cached && cached.expiresAt > now) return cached.value;
  const value = await loadRazorpayConfig();
  cached = { value, expiresAt: now + CACHE_TTL_MS };
  return value;
}

export function invalidateRazorpayConfigCache(): void {
  cached = null;
}

export async function isRazorpayConfigured(): Promise<boolean> {
  const config = await getRazorpayConfig();
  return Boolean(config.keyId && config.keySecret);
}

export async function getRazorpayKeyId(): Promise<string | null> {
  return (await getRazorpayConfig()).keyId;
}
