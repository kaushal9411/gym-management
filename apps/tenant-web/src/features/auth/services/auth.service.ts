import { MOCK_HAPPY_PASSWORD, MOCK_VALID_OTP } from '../constants';
import {
  AuthServiceError,
  type AcceptInvitationPayload,
  type AuthUser,
  type ChangePasswordPayload,
  type EstablishedSession,
  type Invitation,
  type LoginPayload,
  type LoginResult,
  type RegisterGymPayload,
  type ResetPasswordPayload,
  type SessionTokens,
  type VerifyEmailResult,
  type VerifyOtpPayload,
} from '../types';
import { apiClient, toAuthServiceError } from './api-client';

/**
 * Service contract — the ONLY surface hooks/pages are allowed to touch.
 * `HttpAuthService` (below) is the active implementation, calling the real
 * backend; `MockAuthService` is kept for reference/offline development.
 */
export interface AuthService {
  login(payload: LoginPayload): Promise<LoginResult>;
  registerGym(payload: RegisterGymPayload): Promise<{ email: string }>;
  requestPasswordReset(email: string): Promise<void>;
  resetPassword(payload: ResetPasswordPayload): Promise<void>;
  changePassword(payload: ChangePasswordPayload): Promise<void>;
  verifyEmail(token: string): Promise<VerifyEmailResult>;
  resendVerificationEmail(email: string): Promise<void>;
  verifyOtp(payload: VerifyOtpPayload): Promise<EstablishedSession>;
  resendOtp(email: string): Promise<void>;
  getInvitation(token: string): Promise<Invitation>;
  acceptInvitation(payload: AcceptInvitationPayload): Promise<void>;
  /** Re-fetches the current profile from the token already attached by the axios client. */
  fetchCurrentUser(): Promise<{ user: AuthUser; permissions: string[] }>;
  logoutCurrentDevice(refreshToken: string | null): Promise<void>;
  logoutAllDevices(): Promise<void>;
}

// ─────────────────────────────────────────────────────────────────────────
// Backend response envelope + DTO shapes (mirrors apps/api's dto/*.ts)
// ─────────────────────────────────────────────────────────────────────────

interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
}

interface UserProfileDto {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  roles: string[];
  permissions: string[];
}

interface AuthSuccessDto {
  user: UserProfileDto;
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
}

interface OtpChallengeDto {
  challenge: 'otp_required';
  email: string;
  purpose: 'login' | '2fa';
}

function toAuthUser(dto: UserProfileDto): AuthUser {
  const roles = dto.roles.length > 0 ? dto.roles : ['MEMBER'];
  return {
    id: dto.id,
    name: dto.name,
    email: dto.email,
    role: roles[0] as AuthUser['role'],
    roles: roles as AuthUser['roles'],
    tenantId: dto.tenantId,
  };
}

function toSession(dto: AuthSuccessDto): EstablishedSession {
  const tokens: SessionTokens = {
    accessToken: dto.accessToken,
    refreshToken: dto.refreshToken,
    accessTokenExpiresAt: dto.accessTokenExpiresAt,
  };
  return { user: toAuthUser(dto.user), permissions: dto.user.permissions, tokens };
}

// ─────────────────────────────────────────────────────────────────────────
// Real implementation — every call goes through apiClient, which already
// attaches X-Tenant-Slug + Authorization and handles 401 refresh/redirect
// globally (see api-client.ts). Errors are normalized to AuthServiceError.
// ─────────────────────────────────────────────────────────────────────────

class HttpAuthService implements AuthService {
  async login(payload: LoginPayload): Promise<LoginResult> {
    try {
      const res = await apiClient.post<ApiEnvelope<AuthSuccessDto | OtpChallengeDto>>('/auth/login', {
        email: payload.email,
        password: payload.password,
        rememberMe: payload.rememberMe,
      });

      if ('challenge' in res.data.data) {
        return { kind: 'otp_required', email: res.data.data.email, flow: res.data.data.purpose };
      }
      return { kind: 'success', ...toSession(res.data.data) };
    } catch (error) {
      throw toAuthServiceError(error);
    }
  }

  async registerGym(payload: RegisterGymPayload): Promise<{ email: string }> {
    try {
      const res = await apiClient.post<ApiEnvelope<{ email: string; tenantSlug: string }>>(
        '/auth/register',
        payload,
      );
      return { email: res.data.data.email };
    } catch (error) {
      throw toAuthServiceError(error);
    }
  }

  async requestPasswordReset(email: string): Promise<void> {
    try {
      await apiClient.post('/auth/forgot-password', { email });
    } catch (error) {
      throw toAuthServiceError(error);
    }
  }

  async resetPassword({ token, password }: ResetPasswordPayload): Promise<void> {
    try {
      await apiClient.post('/auth/reset-password', { token, password });
    } catch (error) {
      throw toAuthServiceError(error);
    }
  }

  async changePassword(payload: ChangePasswordPayload): Promise<void> {
    try {
      await apiClient.patch('/auth/change-password', payload);
    } catch (error) {
      throw toAuthServiceError(error);
    }
  }

  /**
   * Unlike other calls, verifyEmail resolves to a STRING result rather than
   * throwing on expected failure modes (expired/invalid) — matching what
   * the verify-email screen's TanStack Query hook expects (see
   * hooks/use-auth.ts's useVerifyEmail).
   */
  async verifyEmail(token: string): Promise<VerifyEmailResult> {
    try {
      const res = await apiClient.get<ApiEnvelope<{ status: 'verified' | 'already_verified' }>>(
        '/auth/verify-email',
        { params: { token } },
      );
      return res.data.data.status;
    } catch (error) {
      const authError = toAuthServiceError(error);
      return authError.code === 'TOKEN_EXPIRED' ? 'expired' : 'invalid';
    }
  }

  async resendVerificationEmail(email: string): Promise<void> {
    try {
      await apiClient.post('/auth/resend-verification', { email });
    } catch (error) {
      throw toAuthServiceError(error);
    }
  }

  async verifyOtp({ email, code, flow }: VerifyOtpPayload): Promise<EstablishedSession> {
    try {
      const res = await apiClient.post<ApiEnvelope<AuthSuccessDto>>('/auth/verify-otp', {
        email,
        code,
        purpose: flow === '2fa' ? '2fa' : 'login',
      });
      return toSession(res.data.data);
    } catch (error) {
      throw toAuthServiceError(error);
    }
  }

  async resendOtp(email: string): Promise<void> {
    try {
      await apiClient.post('/auth/resend-otp', { email, purpose: 'login' });
    } catch (error) {
      throw toAuthServiceError(error);
    }
  }

  async fetchCurrentUser(): Promise<{ user: AuthUser; permissions: string[] }> {
    try {
      const res = await apiClient.get<ApiEnvelope<UserProfileDto>>('/auth/me');
      return { user: toAuthUser(res.data.data), permissions: res.data.data.permissions };
    } catch (error) {
      throw toAuthServiceError(error);
    }
  }

  async logoutCurrentDevice(refreshToken: string | null): Promise<void> {
    try {
      await apiClient.post('/auth/logout', refreshToken ? { refreshToken } : {});
    } catch (error) {
      throw toAuthServiceError(error);
    }
  }

  async logoutAllDevices(): Promise<void> {
    try {
      await apiClient.post('/auth/logout-all');
    } catch (error) {
      throw toAuthServiceError(error);
    }
  }

  // Staff/member invitation acceptance has no backend endpoint yet (out of
  // scope for the authentication phases built so far) — surfacing a clear,
  // honest error rather than silently no-op'ing or faking success.
  async getInvitation(): Promise<Invitation> {
    throw new AuthServiceError('TOKEN_INVALID', 'Invitations are not available yet.');
  }

  async acceptInvitation(): Promise<void> {
    throw new AuthServiceError('TOKEN_INVALID', 'Invitations are not available yet.');
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Mock implementation — kept for reference/offline development. Not used
// by default; swap the export below back to `new MockAuthService()` if the
// backend is unavailable.
// ─────────────────────────────────────────────────────────────────────────

const LATENCY_MS = 900;
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function mockUser(email: string): AuthUser {
  return {
    id: 'usr_mock_0001',
    name: email.split('@')[0]!.replace(/[._-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    email,
    role: 'OWNER',
    roles: ['OWNER'],
    tenantId: 'tenant_mock_0001',
  };
}

function mockSession(email: string): EstablishedSession {
  return {
    user: mockUser(email),
    permissions: ['*'],
    tokens: { accessToken: 'mock-access-token', refreshToken: 'mock-refresh-token', accessTokenExpiresAt: new Date(Date.now() + 900_000).toISOString() },
  };
}

class MockAuthService implements AuthService {
  async login({ email, password }: LoginPayload): Promise<LoginResult> {
    await delay(LATENCY_MS);
    const local = email.split('@')[0] ?? '';
    if (local.startsWith('locked')) throw new AuthServiceError('ACCOUNT_LOCKED', 'Too many failed attempts. Try again in 15 minutes.');
    if (local.startsWith('suspended')) throw new AuthServiceError('ACCOUNT_SUSPENDED', 'This account has been suspended.');
    if (local.startsWith('billing')) throw new AuthServiceError('SUBSCRIPTION_EXPIRED', 'The subscription for this gym has expired.');
    if (local.startsWith('trial')) throw new AuthServiceError('TRIAL_EXPIRED', 'The free trial for this gym has ended.');
    if (local.startsWith('unverified')) throw new AuthServiceError('EMAIL_NOT_VERIFIED', 'Please verify your email address first.');
    if (password !== MOCK_HAPPY_PASSWORD) throw new AuthServiceError('INVALID_CREDENTIALS', 'Incorrect email or password.');
    if (local.startsWith('otp')) return { kind: 'otp_required', email, flow: 'login' };
    if (local.startsWith('2fa')) return { kind: 'otp_required', email, flow: '2fa' };
    return { kind: 'success', ...mockSession(email) };
  }

  async registerGym({ slug, email }: RegisterGymPayload): Promise<{ email: string }> {
    await delay(LATENCY_MS + 300);
    if (['goldgym', 'fitnesshub', 'musclefactory', 'taken'].includes(slug)) {
      throw new AuthServiceError('SLUG_TAKEN', `"${slug}" is already in use. Try another subdomain.`);
    }
    return { email };
  }

  async requestPasswordReset(): Promise<void> {
    await delay(LATENCY_MS);
  }

  async resetPassword({ token }: ResetPasswordPayload): Promise<void> {
    await delay(LATENCY_MS);
    if (token === 'expired') throw new AuthServiceError('TOKEN_EXPIRED', 'This reset link has expired. Request a new one.');
    if (!token) throw new AuthServiceError('TOKEN_INVALID', 'This reset link is invalid.');
  }

  async changePassword({ currentPassword }: ChangePasswordPayload): Promise<void> {
    await delay(LATENCY_MS);
    if (currentPassword !== MOCK_HAPPY_PASSWORD) throw new AuthServiceError('INVALID_CREDENTIALS', 'Current password is incorrect.');
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

  async verifyOtp({ code, email }: VerifyOtpPayload): Promise<EstablishedSession> {
    await delay(LATENCY_MS);
    if (code === '000000') throw new AuthServiceError('OTP_EXPIRED', 'This code has expired. Request a new one.');
    if (code !== MOCK_VALID_OTP) throw new AuthServiceError('OTP_INVALID', 'Incorrect code. Check and try again.');
    return mockSession(email);
  }

  async resendOtp(): Promise<void> {
    await delay(LATENCY_MS);
  }

  async fetchCurrentUser(): Promise<{ user: AuthUser; permissions: string[] }> {
    await delay(LATENCY_MS);
    return { user: mockUser('owner@example.com'), permissions: ['*'] };
  }

  async logoutCurrentDevice(): Promise<void> {
    await delay(LATENCY_MS);
  }

  async logoutAllDevices(): Promise<void> {
    await delay(LATENCY_MS);
  }

  async getInvitation(token: string): Promise<Invitation> {
    await delay(LATENCY_MS);
    if (token === 'expired') throw new AuthServiceError('TOKEN_EXPIRED', 'This invitation has expired. Ask for a new one.');
    if (!token || token === 'invalid') throw new AuthServiceError('TOKEN_INVALID', 'This invitation link is not valid.');
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
    if (token === 'expired') throw new AuthServiceError('TOKEN_EXPIRED', 'This invitation has expired.');
  }
}

void MockAuthService; // referenced only to document availability — silence unused-class lint without deleting it

/** The live backend is up (Prompt 5/6) — this is the active implementation. */
export const authService: AuthService = new HttpAuthService();
