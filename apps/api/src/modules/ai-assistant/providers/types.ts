/** Provider-agnostic chat message — every adapter translates to/from its own wire format at the edge. */
export interface AiChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AiCompletionRequest {
  messages: AiChatMessage[];
  model: string;
  temperature: number;
  maxTokens: number;
  /** Ties the outbound provider call to the client connection so "Stop Generation" (closing the SSE response) actually cancels the upstream request instead of burning tokens after the client stopped listening. */
  signal?: AbortSignal;
}

export interface AiCompletionResult {
  content: string;
  promptTokens?: number;
  completionTokens?: number;
}

/**
 * The one interface every AI provider adapter implements — this is the
 * entire surface `ai-chat.service.ts` depends on. Adding a new provider
 * means writing one file that implements this + one line in
 * `factory.ts`'s switch; nothing else in the module changes.
 */
export interface AiProvider {
  readonly name: string;
  complete(request: AiCompletionRequest): Promise<AiCompletionResult>;
  /** Yields incremental text deltas (not cumulative) — the caller accumulates and persists the final joined string. */
  stream(request: AiCompletionRequest): AsyncGenerator<string>;
}
