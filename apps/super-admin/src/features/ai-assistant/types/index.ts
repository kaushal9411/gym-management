export type AiMessageRole = 'USER' | 'ASSISTANT' | 'SYSTEM';

export interface AiConversation {
  id: string;
  adminUserId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface AiMessage {
  id: string;
  conversationId: string;
  role: AiMessageRole;
  content: string;
  createdAt: string;
}

export interface AiConversationDetail extends AiConversation {
  messages: AiMessage[];
}

export interface AiConfig {
  provider: string;
  model: string;
  temperature: number;
  maxTokens: number;
  isConfigured: boolean;
  usingOwnKey: boolean;
}

export type AiProviderName = 'openrouter' | 'openai' | 'anthropic' | 'gemini' | 'azure-openai' | 'ollama';

export interface PlatformAiSettings {
  provider: AiProviderName | null;
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
  apiKey?: string;
  baseUrl?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface PaginatedResult<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export type AiErrorCode = 'AUTH_INVALID' | 'QUOTA_EXCEEDED' | 'NOT_CONFIGURED' | 'GENERIC';

export type ChatStreamEvent =
  | { type: 'delta'; text: string }
  | { type: 'done'; messageId: string; content: string }
  | { type: 'error'; message: string; code?: AiErrorCode };
