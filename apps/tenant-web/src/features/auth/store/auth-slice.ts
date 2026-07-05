import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

import type { RootState } from '@/store';
import type { AuthErrorCode, AuthStatus, AuthUser, OtpFlow, SessionTokens } from '../types';

interface AuthState {
  status: AuthStatus;
  /** True only until the initial silent-refresh-on-load attempt resolves — gates guards from redirecting prematurely. */
  bootstrapping: boolean;
  user: AuthUser | null;
  permissions: string[];
  accessToken: string | null;
  refreshToken: string | null;
  accessTokenExpiresAt: string | null;
  error: { code: AuthErrorCode; message: string } | null;
  /** Set while an OTP/2FA challenge is pending — consumed by the OTP screens. */
  pendingChallenge: { email: string; flow: OtpFlow } | null;
}

const initialState: AuthState = {
  status: 'idle',
  bootstrapping: true,
  user: null,
  permissions: [],
  accessToken: null,
  refreshToken: null,
  accessTokenExpiresAt: null,
  error: null,
  pendingChallenge: null,
};

/**
 * Client/session state. Server state (member lists, bookings, ...) belongs
 * to TanStack Query, never here — but auth is a genuine cross-cutting UI
 * concern (guards, headers, the axios client itself all need synchronous
 * access to it), which is exactly what this slice exists for.
 *
 * Persisted via redux-persist (see store/persist.ts) so a page refresh
 * doesn't sign the user out — see that file for the security tradeoff this
 * implies and why it's an accepted, documented choice for this phase.
 */
const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    authStarted(state) {
      state.status = 'loading';
      state.error = null;
    },
    /** Login / OTP-verify success, or a fresh /auth/me fetch — establishes a full session. */
    sessionEstablished(
      state,
      action: PayloadAction<{ user: AuthUser; permissions: string[]; tokens: SessionTokens }>,
    ) {
      state.status = 'success';
      state.user = action.payload.user;
      state.permissions = action.payload.permissions;
      state.accessToken = action.payload.tokens.accessToken;
      state.refreshToken = action.payload.tokens.refreshToken;
      state.accessTokenExpiresAt = action.payload.tokens.accessTokenExpiresAt;
      state.pendingChallenge = null;
      state.error = null;
    },
    /** Refresh rotation — new tokens, same user/permissions. */
    tokensRefreshed(state, action: PayloadAction<SessionTokens>) {
      state.accessToken = action.payload.accessToken;
      state.refreshToken = action.payload.refreshToken;
      state.accessTokenExpiresAt = action.payload.accessTokenExpiresAt;
    },
    authFailed(state, action: PayloadAction<{ code: AuthErrorCode; message: string }>) {
      state.error = action.payload;
      switch (action.payload.code) {
        case 'ACCOUNT_LOCKED':
          state.status = 'locked';
          break;
        case 'ACCOUNT_SUSPENDED':
        case 'TENANT_SUSPENDED':
          state.status = 'suspended';
          break;
        case 'SUBSCRIPTION_EXPIRED':
        case 'TRIAL_EXPIRED':
        case 'SESSION_EXPIRED':
          state.status = 'expired';
          break;
        default:
          state.status = 'error';
      }
    },
    otpChallengeIssued(state, action: PayloadAction<{ email: string; flow: OtpFlow }>) {
      state.status = 'idle';
      state.pendingChallenge = action.payload;
    },
    sessionExpired(state) {
      state.status = 'expired';
      state.user = null;
      state.permissions = [];
      state.accessToken = null;
      state.refreshToken = null;
      state.accessTokenExpiresAt = null;
    },
    bootstrapFinished(state) {
      state.bootstrapping = false;
    },
    authReset(state) {
      state.status = 'idle';
      state.error = null;
    },
    signedOut() {
      return { ...initialState, bootstrapping: false };
    },
  },
});

export const {
  authStarted,
  sessionEstablished,
  tokensRefreshed,
  authFailed,
  otpChallengeIssued,
  sessionExpired,
  bootstrapFinished,
  authReset,
  signedOut,
} = authSlice.actions;

export const authReducer = authSlice.reducer;

/**
 * THE single source of truth for "is this user signed in" — derived from
 * `user` alone, never from `status`. `status` is transient UI-feedback
 * state (loading/error/locked/…) and is deliberately excluded from
 * persistence (see store/index.ts's blacklist); after a page reload it
 * resets to 'idle' while `user` — which IS persisted — restores correctly.
 * Gating auth on `status === 'success'` would then always be false right
 * after rehydration despite a real signed-in user, which previously
 * produced a login↔dashboard redirect loop. Every guard/hook must use
 * this selector instead of reading `status` directly.
 */
export function selectIsAuthenticated(state: RootState): boolean {
  return state.auth.user !== null;
}
