import { AppError } from '../../../core/errors/app-error';
import { ErrorCode } from '../../../core/errors/error-codes';

import { readSseDataLines } from './sse-parser';
import type { AiChatMessage, AiCompletionRequest, AiCompletionResult, AiProvider } from './types';

interface OpenAiCompatibleConfig {
  name: string;
  baseUrl: string;
  apiKey?: string;
  /** OpenRouter asks (not requires) these for its own model-ranking dashboard — harmless no-op for OpenAI/Ollama. */
  extraHeaders?: Record<string, string>;
  /**
   * Overrides the request URL — defaults to `{baseUrl}/chat/completions`.
   * Azure OpenAI needs this: its deployment is part of the URL path
   * (`/openai/deployments/{model}/chat/completions?api-version=...`), not
   * selected via the JSON body's `model` field like every other
   * OpenAI-compatible provider.
   */
  buildUrl?: (baseUrl: string, model: string) => string;
  /** Azure OpenAI authenticates via a plain `api-key` header instead of `Authorization: Bearer` — everything else about its wire format is identical to the OpenAI Chat Completions shape. */
  authHeader?: (apiKey: string) => Record<string, string>;
}

interface ChatCompletionResponse {
  choices: Array<{ message?: { content?: string | null } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

interface ChatCompletionStreamChunk {
  choices: Array<{ delta?: { content?: string | null } }>;
}

function toWireMessages(messages: AiChatMessage[]): Array<{ role: string; content: string }> {
  return messages.map((m) => ({ role: m.role, content: m.content }));
}

/**
 * Implements the OpenAI Chat Completions wire format — shared verbatim by
 * OpenRouter, OpenAI itself, and a local Ollama daemon (`ollama serve`
 * exposes an OpenAI-compatible `/v1/chat/completions` route), since all
 * three speak the identical request/response/SSE-delta shape. This is what
 * makes switching between them a pure `AI_PROVIDER`/`AI_BASE_URL`/`AI_MODEL`
 * env change — see `factory.ts`.
 */
export class OpenAiCompatibleProvider implements AiProvider {
  readonly name: string;

  constructor(private readonly config: OpenAiCompatibleConfig) {
    this.name = config.name;
  }

  private headers(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      ...(this.config.apiKey ? (this.config.authHeader ?? ((key: string) => ({ Authorization: `Bearer ${key}` })))(this.config.apiKey) : {}),
      ...this.config.extraHeaders,
    };
  }

  private url(model: string): string {
    return this.config.buildUrl ? this.config.buildUrl(this.config.baseUrl, model) : `${this.config.baseUrl}/chat/completions`;
  }

  async complete(request: AiCompletionRequest): Promise<AiCompletionResult> {
    const response = await fetch(this.url(request.model), {
      method: 'POST',
      headers: this.headers(),
      signal: request.signal,
      body: JSON.stringify({
        model: request.model,
        messages: toWireMessages(request.messages),
        temperature: request.temperature,
        max_tokens: request.maxTokens,
        stream: false,
      }),
    });

    if (!response.ok) throw await this.toProviderError(response);
    const body = (await response.json()) as ChatCompletionResponse;
    return {
      content: body.choices[0]?.message?.content ?? '',
      promptTokens: body.usage?.prompt_tokens,
      completionTokens: body.usage?.completion_tokens,
    };
  }

  async *stream(request: AiCompletionRequest): AsyncGenerator<string> {
    const response = await fetch(this.url(request.model), {
      method: 'POST',
      headers: this.headers(),
      signal: request.signal,
      body: JSON.stringify({
        model: request.model,
        messages: toWireMessages(request.messages),
        temperature: request.temperature,
        max_tokens: request.maxTokens,
        stream: true,
      }),
    });

    if (!response.ok || !response.body) throw await this.toProviderError(response);

    for await (const data of readSseDataLines(response.body)) {
      if (data === '[DONE]') return;
      try {
        const chunk = JSON.parse(data) as ChatCompletionStreamChunk;
        const delta = chunk.choices[0]?.delta?.content;
        if (delta) yield delta;
      } catch {
        // A non-JSON SSE line (e.g. OpenRouter's periodic `: keep-alive` comment) — not a data payload, skip it.
      }
    }
  }

  private async toProviderError(response: Response): Promise<AppError> {
    const text = await response.text().catch(() => '');
    return new AppError(
      ErrorCode.INTERNAL_ERROR,
      `${this.name} request failed (${response.status}): ${text.slice(0, 300) || response.statusText}`,
      502,
    );
  }
}
