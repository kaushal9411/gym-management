import { MOCK_HAPPY_PASSWORD, MOCK_VALID_OTP } from '../constants';
import {
  AuthServiceError,
  type AcceptInvitationPayload,
  type AuthUser,
  type Invitation,
  type LoginPayload,
  type LoginResult,
  type RegisterGymPayload,
  type ResetPasswordPayload,
  type VerifyEmailResult,
  type VerifyOtpPayload,
} from '../types';

/**
 * Service contract — the ONLY surface hooks/pages are allowed to touch.
 * `MockAuthService` is active now; `HttpAuthService` (axios) replaces it
 * behind the same interface when the API lands (see api-client.ts).
 */
export interface AuthService {
  login(payload: LoginPayload): Promise<LoginResult>;
  registerGym(payload: RegisterGymPayload): Promise<{ email: string }>;
  requestPasswordReset(email: string): Promise<void>;
  resetPassword(payload: ResetPasswordPayload): Promise<void>;
  verifyEmail(token: string): Promise<VerifyEmailResult>;
  resendVerificationEmail(email: string): Promise<void>;
  verifyOtp(payload: VerifyOtpPayload): Promise<{ user: AuthUser }>;
  resendOtp(email: string): Promise<void>;
  getInvitation(token: string): Promise<Invitation>;
  acceptInvitation(payload: AcceptInvitationPayload): Promise<void>;
}

// ─────────────────────────────────────────────────────────────────────────
// Mock implementation — deterministic outcomes documented in constants/.
// Simulated latency keeps loading states honest.
// ─────────────────────────────────────────────────────────────────────────

const LATENCY_MS = 900;
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function mockUser(email: string): AuthUser {
  return {
    id: 'usr_mock_0001',
    name: email
      .split('@')[0]!
      .replace(/[._-]+/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase()),
    email,
    role: 'OWNER',
    tenantId: 'tenant_mock_0001',
  };
}

class MockAuthService implements AuthService {
  async login({ email, password }: LoginPayload): Promise<LoginResult> {
    await delay(LATENCY_MS);
    const local = email.split('@')[0] ?? '';

    if (local.startsWith('locked')) {
      throw new AuthServiceError('ACCOUNT_LOCKED', 'Too many failed attempts. Try again in 15 minutes.');
    }
    if (local.startsWith('suspended')) {
      throw new AuthServiceError('ACCOUNT_SUSPENDED', 'This account has been suspended.');
    }
    if (local.startsWith('billing')) {
      throw new AuthServiceError('SUBSCRIPTION_EXPIRED', 'The subscription for this gym has expired.');
    }
    if (local.startsWith('trial')) {
      throw new AuthServiceError('TRIAL_EXPIRED', 'The free trial for this gym has ended.');
    }
    if (local.startsWith('unverified')) {
      throw new AuthServiceError('EMAIL_NOT_VERIFIED', 'Please verify your email address first.');
    }
    if (password !== MOCK_HAPPY_PASSWORD) {
      throw new AuthServiceError('INVALID_CREDENTIALS', 'Incorrect email or password.');
    }
    if (local.startsWith('otp')) {
      return { kind: 'otp_required', email, flow: 'login' };
    }
    if (local.startsWith('2fa')) {
      return { kind: 'otp_required', email, flow: '2fa' };
    }
    return { kind: 'success', user: mockUser(email) };
  }

  async registerGym({ slug, email }: RegisterGymPayload): Promise<{ email: string }> {
    await delay(LATENCY_MS + 300);
    if (['goldgym', 'fitnesshub', 'musclefactory', 'taken'].includes(slug)) {
      throw new AuthServiceError('SLUG_TAKEN', `“${slug}” is already in use. Try another subdomain.`);
    }
    return { email };
  }

  async requestPasswordReset(): Promise<void> {
    // Always succeeds — the API must not reveal whether an email exists.
    await delay(LATENCY_MS);
  }

  async resetPassword({ token }: ResetPasswordPayload): Promise<void> {
    await delay(LATENCY_MS);
    if (token === 'expired') {
      throw new AuthServiceError('TOKEN_EXPIRED', 'This reset link has expired. Request a new one.');
    }
    if (!token) {
      throw new AuthServiceError('TOKEN_INVALID', 'This reset link is invalid.');
    }
  }

  async verifyEmail(token: string): Promise<VerifyEmailResult> {
    await delay(LATENCY_MS);
    if (token === 'expired') return 'expired';
    if (token === 'used') return 'already_verified';
    if (!token) return 'invalid';
    return 'verified';
  }

  async resendVerificationEmail(): Promise<void> {
    await delay(LATENCY_MS);
  }

  async verifyOtp({ code, email }: VerifyOtpPayload): Promise<{ user: AuthUser }> {
    await delay(LATENCY_MS);
    if (code === '000000') {
      throw new AuthServiceError('OTP_EXPIRED', 'This code has expired. Request a new one.');
    }
    if (code !== MOCK_VALID_OTP) {
      throw new AuthServiceError('OTP_INVALID', 'Incorrect code. Check and try again.');
    }
    return { user: mockUser(email) };
  }

  async resendOtp(): Promise<void> {
    await delay(LATENCY_MS);
  }

  async getInvitation(token: string): Promise<Invitation> {
    await delay(LATENCY_MS);
    if (token === 'expired') {
      throw new AuthServiceError('TOKEN_EXPIRED', 'This invitation has expired. Ask for a new one.');
    }
    if (!token || token === 'invalid') {
      throw new AuthServiceError('TOKEN_INVALID', 'This invitation link is not valid.');
    }
    return {
      token,
      gymName: "Gold's Gym",
      invitedBy: 'Arjun Mehta (Owner)',
      inviteeEmail: 'new.trainer@example.com',
      role: 'TRAINER',
      expiresAt: new Date(Date.now() + 48 * 3600_000).toISOString(),
    };
  }

  async acceptInvitation({ token }: AcceptInvitationPayload): Promise<void> {
    await delay(LATENCY_MS + 200);
    if (token === 'expired') {
      throw new AuthServiceError('TOKEN_EXPIRED', 'This invitation has expired.');
    }
  }
}

/** Swap point: `new HttpAuthService(apiClient)` once the backend is live. */
export const authService: AuthService = new MockAuthService();
