export interface MemberProfile {
  id: string;
  memberId: string;
  name: string;
  email: string | null;
}

export interface MemberSessionTokens {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: string;
}

export type MemberAuthStatus = 'idle' | 'loading' | 'success' | 'error' | 'locked' | 'suspended';

export type MemberAuthErrorCode =
  | 'INVALID_CREDENTIALS'
  | 'ACCOUNT_LOCKED'
  | 'ACCOUNT_SUSPENDED'
  | 'TOKEN_INVALID'
  | 'TOKEN_EXPIRED'
  | 'RATE_LIMITED'
  | 'UNKNOWN';

export class MemberAuthServiceError extends Error {
  constructor(
    public code: MemberAuthErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'MemberAuthServiceError';
  }
}
