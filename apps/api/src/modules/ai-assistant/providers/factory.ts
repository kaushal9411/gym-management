import { env } from '../../../config/env';
import { AppError } from '../../../core/errors/app-error';
import { ErrorCode } from '../../../core/errors/error-codes';

import { AnthropicProvider } from './anthropic.provider';
import type { AiErrorCode } from './error-classification';
import { GeminiProvider } from './gemini.provider';
import { OpenAiCompatibleProvider } from './openai-compatible.provider';
import type { AiProvider } from './types';

const DEFAULT_BASE_URLS: Record<string, string> = {
  openrouter: 'https://openrouter.ai/api/v1',
  openai: 'https://api.openai.com/v1',
  anthropic: 'https://api.anthropic.com/v1',
  gemini: 'https://generativelanguage.googleapis.com/v1beta',
  ollama: 'http://localhost:11434/v1',
  // azure-openai has no sane default — every Azure resource has its own URL; AI_BASE_URL is required for it.
};

/** A tenant's own "bring your own key" override (`TenantAiSettings`) — every field optional, `undefined` falls through to the platform-wide `env.ai.*` default. */
export interface AiConfigOverride {
  provider?: string;
  model?: string;
  apiKey?: string;
  baseUrl?: string;
  temperature?: number;
  maxTokens?: number;
}

interface EffectiveAiConfig {
  provider: string;
  model: string;
  apiKey?: string;
  baseUrl?: string;
  temperature: number;
  maxTokens: number;
}

let cachedPlatformProvider: AiProvider | null = null;

/** Merges a tenant override over the platform default — `||` throughout, not `??`, for the same reason `AI_BASE_URL=` (declared-but-empty) needs it: an override field can be an empty string from a partially-filled form, which should still fall through to the platform value. */
function resolveEffectiveConfig(override?: AiConfigOverride): EffectiveAiConfig {
  return {
    provider: override?.provider || env.ai.provider,
    model: override?.model || env.ai.model,
    apiKey: override?.apiKey || env.ai.apiKey,
    baseUrl: override?.baseUrl || env.ai.baseUrl,
    temperature: override?.temperature ?? env.ai.temperature,
    maxTokens: override?.maxTokens ?? env.ai.maxTokens,
  };
}

function isConfigured(config: EffectiveAiConfig): boolean {
  return config.provider === 'ollama' || Boolean(config.apiKey);
}

function buildProvider(config: EffectiveAiConfig): AiProvider {
  if (!isConfigured(config)) {
    const code: AiErrorCode = 'NOT_CONFIGURED';
    throw new AppError(
      ErrorCode.VALIDATION_ERROR,
      'The AI assistant is not configured — set an API key (or switch to provider=ollama for a local model) in AI Settings, or ask your platform administrator to configure AI_API_KEY.',
      503,
      { code },
    );
  }

  // `||` deliberately, not `??` — an empty-but-present AI_BASE_URL (e.g. `AI_BASE_URL=` in `.env`) is a real, valid string as far as zod's `.optional()` is concerned (only `undefined` counts as "absent"), so `??` never falls through to the provider default for the common case of an unset-but-declared env var.
  const baseUrl = config.baseUrl || DEFAULT_BASE_URLS[config.provider];
  if (!baseUrl) {
    const code: AiErrorCode = 'NOT_CONFIGURED';
    throw new AppError(ErrorCode.VALIDATION_ERROR, `A base URL is required for provider "${config.provider}".`, 503, { code });
  }

  switch (config.provider) {
    case 'openrouter':
      return new OpenAiCompatibleProvider({
        name: 'openrouter',
        baseUrl,
        apiKey: config.apiKey,
        extraHeaders: { 'HTTP-Referer': env.platformDomain, 'X-Title': 'FitCloud AI Business Assistant' },
      });
    case 'openai':
      return new OpenAiCompatibleProvider({ name: 'openai', baseUrl, apiKey: config.apiKey });
    case 'ollama':
      // Local daemon — no API key needed; still passed through if one was set (e.g. behind a reverse-proxy auth).
      return new OpenAiCompatibleProvider({ name: 'ollama', baseUrl, apiKey: config.apiKey });
    case 'azure-openai':
      return new OpenAiCompatibleProvider({
        name: 'azure-openai',
        baseUrl,
        apiKey: config.apiKey,
        authHeader: (key) => ({ 'api-key': key }),
        buildUrl: (base, model) => `${base}/openai/deployments/${model}/chat/completions?api-version=2024-06-01`,
      });
    case 'anthropic':
      return new AnthropicProvider({ baseUrl, apiKey: config.apiKey! });
    case 'gemini':
      return new GeminiProvider({ baseUrl, apiKey: config.apiKey! });
    default:
      throw new AppError(ErrorCode.VALIDATION_ERROR, `Unknown AI provider: ${config.provider}`, 503);
  }
}

/**
 * The single switch statement (`buildProvider`) this whole module's
 * provider-agnostic design hinges on. With no `override`, returns a cached
 * singleton built from the platform-wide `env.ai.*` config (never rebuilt
 * per request). With a tenant `override` (`TenantAiSettings` — "bring your
 * own key"), always builds a fresh, uncached instance — these adapters are
 * thin stateless `fetch()` wrappers, so there's no connection-pooling cost
 * to reconstructing one per request, and caching per-tenant would need a
 * `Map` keyed by tenant + a cache-invalidation story for zero benefit.
 */
export function getAiProvider(override?: AiConfigOverride): AiProvider {
  if (override) return buildProvider(resolveEffectiveConfig(override));

  cachedPlatformProvider ??= buildProvider(resolveEffectiveConfig());
  return cachedPlatformProvider;
}

export function getEffectiveAiConfig(override?: AiConfigOverride): EffectiveAiConfig {
  return resolveEffectiveConfig(override);
}
