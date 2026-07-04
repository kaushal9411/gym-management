/** Roles mirrored from shared-constants (backend arrives in a later phase). */
export type UserRole = 'OWNER' | 'MANAGER' | 'TRAINER' | 'RECEPTIONIST' | 'MEMBER';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  tenantId: string;
}

/** Finite auth machine — drives every screen's rendering. */
export type AuthStatus =
  | 'idle'
  | 'loading'
  | 'success'
  | 'error'
  | 'locked'
  | 'expired'
  | 'suspended';

/** Stable machine-readable error codes (mirrors the API error catalog). */
export type AuthErrorCode =
  | 'INVALID_CREDENTIALS'
  | 'ACCOUNT_LOCKED'
  | 'ACCOUNT_SUSPENDED'
  | 'TENANT_SUSPENDED'
  | 'SUBSCRIPTION_EXPIRED'
  | 'TRIAL_EXPIRED'
  | 'SESSION_EXPIRED'
  | 'EMAIL_NOT_VERIFIED'
  | 'OTP_INVALID'
  | 'OTP_EXPIRED'
  | 'TOKEN_INVALID'
  | 'TOKEN_EXPIRED'
  | 'SLUG_TAKEN'
  | 'RATE_LIMITED'
  | 'MAINTENANCE'
  | 'UNKNOWN';

/** Typed service error — thrown by services, mapped to UX by hooks/pages. */
export class AuthServiceError extends Error {
  constructor(
    public readonly code: AuthErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'AuthServiceError';
  }
}

// ── Payloads ────────────────────────────────────────────────────────────
export interface LoginPayload {
  email: string;
  password: string;
  rememberMe: boolean;
}

export interface RegisterGymPayload {
  gymName: string;
  slug: string;
  ownerName: string;
  email: string;
  password: string;
}

export interface ResetPasswordPayload {
  token: string;
  password: string;
}

export interface VerifyOtpPayload {
  email: string;
  code: string;
  /** Which flow initiated the challenge — login | login-2fa | registration. */
  flow: OtpFlow;
}

export type OtpFlow = 'login' | '2fa' | 'register';

export interface AcceptInvitationPayload {
  token: string;
  name: string;
  phone?: string;
  password: string;
}

// ── Results ─────────────────────────────────────────────────────────────
export type LoginResult =
  | { kind: 'success'; user: AuthUser }
  | { kind: 'otp_required'; email: string; flow: OtpFlow };

export interface Invitation {
  token: string;
  gymName: string;
  invitedBy: string;
  inviteeEmail: string;
  role: UserRole;
  expiresAt: string;
}

export type VerifyEmailResult = 'verified' | 'already_verified' | 'expired' | 'invalid';
