import { decryptSecret, encryptSecret, maskSecret } from '../../../core/security/encryption.util';
import { getTenantScopedClient } from '../../../infrastructure/database/tenant-scoped-client';
import type { AiConfigOverride } from '../providers/factory';
import { TenantAiSettingsRepository, type TenantAiSettingsUpdate } from '../repositories/tenant-ai-settings.repository';

export interface TenantAiSettingsView {
  provider: string | null;
  model: string | null;
  baseUrl: string | null;
  temperature: number | null;
  maxTokens: number | null;
  hasApiKey: boolean;
  apiKeyMasked: string | null;
  /** `true` when no override row exists at all — the tenant is fully on the platform-wide config. */
  usingPlatformDefault: boolean;
}

export interface UpdateTenantAiSettingsInput {
  provider?: string;
  model?: string;
  /** Omitted = leave the existing key untouched; `''` = clear it (fall back to the platform key); anything else = replace it. */
  apiKey?: string;
  baseUrl?: string;
  temperature?: number;
  maxTokens?: number;
}

/** `''` clears a string field back to "use platform default" (`null`); `undefined` (the key wasn't in the request body at all) leaves it untouched. */
function stringField(value: string | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  return value === '' ? null : value;
}

export class AiTenantSettingsService {
  private readonly repo: TenantAiSettingsRepository;

  constructor(private readonly tenantId: string) {
    this.repo = new TenantAiSettingsRepository(getTenantScopedClient(tenantId));
  }

  async getView(): Promise<TenantAiSettingsView> {
    const row = await this.repo.find(this.tenantId);
    if (!row) {
      return { provider: null, model: null, baseUrl: null, temperature: null, maxTokens: null, hasApiKey: false, apiKeyMasked: null, usingPlatformDefault: true };
    }

    let apiKeyMasked: string | null = null;
    if (row.apiKeyEncrypted) {
      try {
        apiKeyMasked = maskSecret(decryptSecret(row.apiKeyEncrypted));
      } catch {
        apiKeyMasked = '••••'; // a decrypt failure (e.g. ENCRYPTION_KEY rotated) shouldn't break the settings page — just can't show the real suffix
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
      usingPlatformDefault: false,
    };
  }

  async update(input: UpdateTenantAiSettingsInput): Promise<TenantAiSettingsView> {
    const data: TenantAiSettingsUpdate = {
      provider: stringField(input.provider),
      model: stringField(input.model),
      baseUrl: stringField(input.baseUrl),
      temperature: input.temperature,
      maxTokens: input.maxTokens,
    };
    if (input.apiKey !== undefined) {
      data.apiKeyEncrypted = input.apiKey === '' ? null : encryptSecret(input.apiKey);
    }

    await this.repo.upsert(this.tenantId, data);
    return this.getView();
  }

  async reset(): Promise<void> {
    await this.repo.clear(this.tenantId);
  }

  /** The override object `providers/factory.ts#getAiProvider()` merges over the platform default — `null` for this tenant means "no override row at all," resolving to `undefined` for every field. */
  async resolveProviderOverride(): Promise<AiConfigOverride | undefined> {
    const row = await this.repo.find(this.tenantId);
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
