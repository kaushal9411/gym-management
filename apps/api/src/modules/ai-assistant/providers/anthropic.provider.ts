import { AppError } from '../../../core/errors/app-error';
import { ErrorCode } from '../../../core/errors/error-codes';

import { classifyProviderHttpStatus } from './error-classification';
import { readSseDataLines } from './sse-parser';
import type { AiChatMessage, AiCompletionRequest, AiCompletionResult, AiProvider } from './types';

const ANTHROPIC_VERSION = '2023-06-01';

interface AnthropicConfig {
  baseUrl: string;
  apiKey: string;
}

interface MessagesResponse {
  content: Array<{ type: string; text?: string }>;
  usage?: { input_tokens?: number; output_tokens?: number };
}

/** Anthropic's system prompt is a distinct top-level field, not a `system`-role entry inside `messages` — its `messages` array must alternate strictly user/assistant. */
function splitSystemPrompt(messages: AiChatMessage[]): { system?: string; rest: Array<{ role: 'user' | 'assistant'; content: string }> } {
  const systemParts = messages.filter((m) => m.role === 'system').map((m) => m.content);
  const rest = messages.filter((m): m is AiChatMessage & { role: 'user' | 'assistant' } => m.role !== 'system');
  return { system: systemParts.length > 0 ? systemParts.join('\n\n') : undefined, rest };
}

/** Implements Anthropic's Messages API (`POST /messages`) — a distinct wire format from the OpenAI-compatible family (separate system field, `x-api-key`/`anthropic-version` headers, named SSE event types). */
export class AnthropicProvider implements AiProvider {
  readonly name = 'anthropic';

  constructor(private readonly config: AnthropicConfig) {}

  private headers(): Record<string, string> {
    return { 'Content-Type': 'application/json', 'x-api-key': this.config.apiKey, 'anthropic-version': ANTHROPIC_VERSION };
  }

  async complete(request: AiCompletionRequest): Promise<AiCompletionResult> {
    const { system, rest } = splitSystemPrompt(request.messages);
    const response = await fetch(`${this.config.baseUrl}/messages`, {
      method: 'POST',
      headers: this.headers(),
      signal: request.signal,
      body: JSON.stringify({ model: request.model, system, messages: rest, temperature: request.temperature, max_tokens: request.maxTokens }),
    });

    if (!response.ok) throw await this.toProviderError(response);
    const body = (await response.json()) as MessagesResponse;
    return {
      content: body.content.filter((b) => b.type === 'text').map((b) => b.text ?? '').join(''),
      promptTokens: body.usage?.input_tokens,
      completionTokens: body.usage?.output_tokens,
    };
  }

  async *stream(request: AiCompletionRequest): AsyncGenerator<string> {
    const { system, rest } = splitSystemPrompt(request.messages);
    const response = await fetch(`${this.config.baseUrl}/messages`, {
      method: 'POST',
      headers: this.headers(),
      signal: request.signal,
      body: JSON.stringify({ model: request.model, system, messages: rest, temperature: request.temperature, max_tokens: request.maxTokens, stream: true }),
    });

    if (!response.ok || !response.body) throw await this.toProviderError(response);

    for await (const data of readSseDataLines(response.body)) {
      try {
        const event = JSON.parse(data) as { type: string; delta?: { type: string; text?: string } };
        if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta' && event.delta.text) {
          yield event.delta.text;
        }
      } catch {
        // Non-JSON keep-alive line — skip.
      }
    }
  }

  private async toProviderError(response: Response): Promise<AppError> {
    const text = await response.text().catch(() => '');
    return new AppError(
      ErrorCode.INTERNAL_ERROR,
      `anthropic request failed (${response.status}): ${text.slice(0, 300) || response.statusText}`,
      502,
      { code: classifyProviderHttpStatus(response.status) },
    );
  }
}
