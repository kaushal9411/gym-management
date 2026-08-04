import { env } from '../../../config/env';
import { AppError } from '../../../core/errors/app-error';
import { ErrorCode } from '../../../core/errors/error-codes';

import { AnthropicProvider } from './anthropic.provider';
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

let cached: AiProvider | null = null;
let cachedKey = '';

/**
 * The single switch statement this whole module's provider-agnostic design
 * hinges on — `AI_PROVIDER` picks the adapter, everything else (model, key,
 * base URL, temperature, max tokens) is generic config read once from
 * `env.ai`. Adding a genuinely new wire format later means one new adapter
 * file implementing `AiProvider` + one new `case` here; nothing in
 * `ai-chat.service.ts` or the routes/controllers ever changes.
 */
export function getAiProvider(): AiProvider {
  const cacheKey = `${env.ai.provider}:${env.ai.baseUrl ?? ''}:${env.ai.apiKey ?? ''}`;
  if (cached && cachedKey === cacheKey) return cached;

  if (!env.ai.isConfigured) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, 'The AI assistant is not configured for this environment — set AI_API_KEY (or switch AI_PROVIDER=ollama for a local model).', 503);
  }

  // `||` deliberately, not `??` — an empty-but-present AI_BASE_URL (e.g. `AI_BASE_URL=` in `.env`) is a real, valid string as far as zod's `.optional()` is concerned (only `undefined` counts as "absent"), so `??` never falls through to the provider default for the common case of an unset-but-declared env var.
  const baseUrl = env.ai.baseUrl || DEFAULT_BASE_URLS[env.ai.provider];
  if (!baseUrl) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, `AI_BASE_URL is required for provider "${env.ai.provider}".`, 503);
  }

  switch (env.ai.provider) {
    case 'openrouter':
      cached = new OpenAiCompatibleProvider({
        name: 'openrouter',
        baseUrl,
        apiKey: env.ai.apiKey,
        extraHeaders: { 'HTTP-Referer': env.platformDomain, 'X-Title': 'FitCloud AI Business Assistant' },
      });
      break;
    case 'openai':
      cached = new OpenAiCompatibleProvider({ name: 'openai', baseUrl, apiKey: env.ai.apiKey });
      break;
    case 'ollama':
      // Local daemon — no API key needed; still passed through if the user set one (e.g. behind a reverse-proxy auth).
      cached = new OpenAiCompatibleProvider({ name: 'ollama', baseUrl, apiKey: env.ai.apiKey });
      break;
    case 'azure-openai':
      cached = new OpenAiCompatibleProvider({
        name: 'azure-openai',
        baseUrl,
        apiKey: env.ai.apiKey,
        authHeader: (key) => ({ 'api-key': key }),
        buildUrl: (base, model) => `${base}/openai/deployments/${model}/chat/completions?api-version=2024-06-01`,
      });
      break;
    case 'anthropic':
      cached = new AnthropicProvider({ baseUrl, apiKey: env.ai.apiKey! });
      break;
    case 'gemini':
      cached = new GeminiProvider({ baseUrl, apiKey: env.ai.apiKey! });
      break;
    default:
      throw new AppError(ErrorCode.VALIDATION_ERROR, `Unknown AI_PROVIDER: ${env.ai.provider as string}`, 503);
  }

  cachedKey = cacheKey;
  return cached;
}
