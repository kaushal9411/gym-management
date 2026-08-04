import { decryptSecret, encryptSecret, maskSecret } from '../../../core/security/encryption.util';
import type { AiConfigOverride } from '../../ai-assistant/providers/factory';
import { platformAiSettingsRepository } from '../repositories/platform-ai-settings.repository';

export interface PlatformAiSettingsView {
  provider: string | null;
  model: string | null;
  baseUrl: string | null;
  temperature: number | null;
  maxTokens: number | null;
  hasApiKey: boolean;
  apiKeyMasked: string | null;
}

export interface UpdatePlatformAiSettingsInput {
  provider?: string;
  model?: string;
  /** Omitted = leave the existing key untouched; `''` = clear it; anything else = replace it. */
  apiKey?: string;
  baseUrl?: string;
  temperature?: number;
  maxTokens?: number;
}

function stringField(value: string | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  return value === '' ? null : value;
}

/**
 * The super-admin equivalent of `AiTenantSettingsService` — same shape, but
 * backed by the application-enforced single-row `PlatformAiSettings` table
 * instead of a per-tenant one (there's only one "platform team" to override
 * for). Deliberately reuses the tenant-side `AiConfigOverride` type and the
 * same `providers/factory.ts` — the provider abstraction doesn't care
 * whether the caller is a tenant or the platform team.
 */
export class AdminAiSettingsService {
  async getView(): Promise<PlatformAiSettingsView> {
    const row = await platformAiSettingsRepository.find();
    if (!row) return { provider: null, model: null, baseUrl: null, temperature: null, maxTokens: null, hasApiKey: false, apiKeyMasked: null };

    let apiKeyMasked: string | null = null;
    if (row.apiKeyEncrypted) {
      try {
        apiKeyMasked = maskSecret(decryptSecret(row.apiKeyEncrypted));
      } catch {
        apiKeyMasked = '••••';
      }
    }

    return {
      provider: row.provider,
      model: row.model,
      baseUrl: row.baseUrl,
      temperature: row.temperature,
      maxTokens: row.maxTokens,
      hasApiKey: Boolean(row.apiKeyEncrypted),
      apiKeyMasked,
    };
  }

  async update(input: UpdatePlatformAiSettingsInput, adminUserId: string): Promise<PlatformAiSettingsView> {
    const data: Parameters<typeof platformAiSettingsRepository.upsert>[0] = {
      provider: stringField(input.provider),
      model: stringField(input.model),
      baseUrl: stringField(input.baseUrl),
      temperature: input.temperature,
      maxTokens: input.maxTokens,
      updatedBy: adminUserId,
    };
    if (input.apiKey !== undefined) {
      data.apiKeyEncrypted = input.apiKey === '' ? null : encryptSecret(input.apiKey);
    }

    await platformAiSettingsRepository.upsert(data);
    return this.getView();
  }

  async reset(): Promise<void> {
    await platformAiSettingsRepository.clear();
  }

  async resolveProviderOverride(): Promise<AiConfigOverride | undefined> {
    const row = await platformAiSettingsRepository.find();
    if (!row) return undefined;

    return {
      provider: row.provider ?? undefined,
      model: row.model ?? undefined,
      apiKey: row.apiKeyEncrypted ? decryptSecret(row.apiKeyEncrypted) : undefined,
      baseUrl: row.baseUrl ?? undefined,
      temperature: row.temperature ?? undefined,
      maxTokens: row.maxTokens ?? undefined,
    };
  }
}

export const adminAiSettingsService = new AdminAiSettingsService();
