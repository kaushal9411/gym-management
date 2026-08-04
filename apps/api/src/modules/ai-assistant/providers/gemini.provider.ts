import { AppError } from '../../../core/errors/app-error';
import { ErrorCode } from '../../../core/errors/error-codes';

import { readSseDataLines } from './sse-parser';
import type { AiChatMessage, AiCompletionRequest, AiCompletionResult, AiProvider } from './types';

interface GeminiConfig {
  baseUrl: string;
  apiKey: string;
}

interface GenerateContentResponse {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
}

/** Gemini uses `user`/`model` roles (not `assistant`) and, like Anthropic, a separate system field (`systemInstruction`) rather than a system-role message. */
function toGeminiPayload(messages: AiChatMessage[]) {
  const systemParts = messages.filter((m) => m.role === 'system').map((m) => m.content);
  const contents = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));
  return {
    contents,
    systemInstruction: systemParts.length > 0 ? { parts: [{ text: systemParts.join('\n\n') }] } : undefined,
  };
}

function extractText(response: GenerateContentResponse): string {
  return (response.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? '').join('');
}

/** Implements Google's `generateContent`/`streamGenerateContent` REST API — the API key is a query param, not a header, which is this provider's main wire-format quirk vs. the others. */
export class GeminiProvider implements AiProvider {
  readonly name = 'gemini';

  constructor(private readonly config: GeminiConfig) {}

  async complete(request: AiCompletionRequest): Promise<AiCompletionResult> {
    const url = `${this.config.baseUrl}/models/${request.model}:generateContent?key=${encodeURIComponent(this.config.apiKey)}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: request.signal,
      body: JSON.stringify({
        ...toGeminiPayload(request.messages),
        generationConfig: { temperature: request.temperature, maxOutputTokens: request.maxTokens },
      }),
    });

    if (!response.ok) throw await this.toProviderError(response);
    const body = (await response.json()) as GenerateContentResponse;
    return { content: extractText(body), promptTokens: body.usageMetadata?.promptTokenCount, completionTokens: body.usageMetadata?.candidatesTokenCount };
  }

  async *stream(request: AiCompletionRequest): AsyncGenerator<string> {
    const url = `${this.config.baseUrl}/models/${request.model}:streamGenerateContent?alt=sse&key=${encodeURIComponent(this.config.apiKey)}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: request.signal,
      body: JSON.stringify({
        ...toGeminiPayload(request.messages),
        generationConfig: { temperature: request.temperature, maxOutputTokens: request.maxTokens },
      }),
    });

    if (!response.ok || !response.body) throw await this.toProviderError(response);

    for await (const data of readSseDataLines(response.body)) {
      try {
        const chunk = JSON.parse(data) as GenerateContentResponse;
        const text = extractText(chunk);
        if (text) yield text;
      } catch {
        // Non-JSON keep-alive line — skip.
      }
    }
  }

  private async toProviderError(response: Response): Promise<AppError> {
    const text = await response.text().catch(() => '');
    return new AppError(ErrorCode.INTERNAL_ERROR, `gemini request failed (${response.status}): ${text.slice(0, 300) || response.statusText}`, 502);
  }
}
