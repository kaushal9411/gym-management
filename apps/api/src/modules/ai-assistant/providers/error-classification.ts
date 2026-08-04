/**
 * What the CHAT UI does with a failed provider call differs by cause: an
 * invalid/revoked key and "you're out of credit or rate-limited" both need
 * a "go fix your AI Settings" call to action, a generic 5xx just needs a
 * "try again." Every provider adapter classifies its own HTTP failure into
 * one of these and attaches it via `AppError`'s `details.code`.
 */
export type AiErrorCode = 'AUTH_INVALID' | 'QUOTA_EXCEEDED' | 'NOT_CONFIGURED' | 'GENERIC';

export function classifyProviderHttpStatus(status: number): AiErrorCode {
  if (status === 401 || status === 403) return 'AUTH_INVALID';
  if (status === 402 || status === 429) return 'QUOTA_EXCEEDED';
  return 'GENERIC';
}
