import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

import type { AuthErrorCode, AuthStatus, AuthUser, OtpFlow } from '../types';

interface AuthState {
  status: AuthStatus;
  user: AuthUser | null;
  error: { code: AuthErrorCode; message: string } | null;
  /** Set while an OTP/2FA challenge is pending — consumed by the OTP screens. */
  pendingChallenge: { email: string; flow: OtpFlow } | null;
}

const initialState: AuthState = {
  status: 'idle',
  user: null,
  error: null,
  pendingChallenge: null,
};

/**
 * Client/session state only. The mutations themselves run through TanStack
 * Query — this slice records their outcome so ANY component (headers,
 * guards, banners) can react without prop drilling.
 */
const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    authStarted(state) {
      state.status = 'loading';
      state.error = null;
    },
    authSucceeded(state, action: PayloadAction<AuthUser>) {
      state.status = 'success';
      state.user = action.payload;
      state.pendingChallenge = null;
      state.error = null;
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
    },
    authReset(state) {
      state.status = 'idle';
      state.error = null;
    },
    signedOut() {
      return initialState;
    },
  },
});

export const {
  authStarted,
  authSucceeded,
  authFailed,
  otpChallengeIssued,
  sessionExpired,
  authReset,
  signedOut,
} = authSlice.actions;

export const authReducer = authSlice.reducer;
