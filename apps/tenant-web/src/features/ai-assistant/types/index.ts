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
}

export interface PaginatedResult<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/** Mirrors the backend's SSE event shape (`ChatStreamEvent`) verbatim. */
export type ChatStreamEvent =
  | { type: 'delta'; text: string }
  | { type: 'done'; messageId: string; content: string; action: AiActionProposal | null }
  | { type: 'error'; message: string };
