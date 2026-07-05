export type AdminErrorCode =
  | 'INVALID_CREDENTIALS'
  | 'ACCOUNT_LOCKED'
  | 'ACCOUNT_SUSPENDED'
  | 'SESSION_EXPIRED'
  | 'TOKEN_INVALID'
  | 'TOKEN_EXPIRED'
  | 'FORBIDDEN'
  | 'RATE_LIMITED'
  | 'UNKNOWN';

export class AdminServiceError extends Error {
  constructor(
    public readonly code: AdminErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'AdminServiceError';
  }
}

export interface AdminProfile {
  id: string;
  name: string;
  email: string;
  role: string;
  permissions: string[];
  status: string;
  lastLoginAt: string | null;
}

export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: string;
}

export type AuthStatus = 'idle' | 'loading' | 'success' | 'error' | 'locked';

export interface LoginPayload {
  email: string;
  password: string;
}

export interface EstablishedSession {
  admin: AdminProfile;
  tokens: SessionTokens;
}
