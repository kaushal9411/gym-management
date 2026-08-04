export type AiMessageRole = 'USER' | 'ASSISTANT' | 'SYSTEM';

export type AiActionType = 'create_member' | 'renew_membership' | 'assign_workout' | 'assign_diet' | 'generate_report' | 'send_notification';

export interface AiActionProposal {
  type: AiActionType;
  params: Record<string, unknown>;
  summary: string;
}

export interface AiConversation {
  id: string;
  tenantId: string;
  userId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface AiMessage {
  id: string;
  conversationId: string;
  role: AiMessageRole;
  content: string;
  actionPayload: AiActionProposal | null;
  actionStatus: 'PENDING' | 'CONFIRMED' | 'CANCELLED' | null;
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
  /** `true` when this tenant is using their own BYOK key rather than the platform default. */
  usingOwnKey: boolean;
}

export type AiProviderName = 'openrouter' | 'openai' | 'anthropic' | 'gemini' | 'azure-openai' | 'ollama';

/** This tenant's own AI provider override ("bring your own key") — every field `null` means "using the platform default" for that field. The raw API key is never returned, only a masked last-4 indicator. */
export interface TenantAiSettings {
  provider: AiProviderName | null;
  model: string | null;
  baseUrl: string | null;
  temperature: number | null;
  maxTokens: number | null;
  hasApiKey: boolean;
  apiKeyMasked: string | null;
  usingPlatformDefault: boolean;
}

export interface UpdateTenantAiSettingsInput {
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

/** Mirrors the backend's SSE event shape (`ChatStreamEvent`) verbatim. */
export type ChatStreamEvent =
  | { type: 'delta'; text: string }
  | { type: 'done'; messageId: string; content: string; action: AiActionProposal | null }
  | { type: 'error'; message: string; code?: AiErrorCode };
