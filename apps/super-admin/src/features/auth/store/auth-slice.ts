import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

import type { RootState } from '@/store';
import type { AdminErrorCode, AdminProfile, AuthStatus, SessionTokens } from '../types';

interface AuthState {
  status: AuthStatus;
  bootstrapping: boolean;
  admin: AdminProfile | null;
  accessToken: string | null;
  refreshToken: string | null;
  accessTokenExpiresAt: string | null;
  error: { code: AdminErrorCode; message: string } | null;
}

const initialState: AuthState = {
  status: 'idle',
  bootstrapping: true,
  admin: null,
  accessToken: null,
  refreshToken: null,
  accessTokenExpiresAt: null,
  error: null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    authStarted(state) {
      state.status = 'loading';
      state.error = null;
    },
    sessionEstablished(state, action: PayloadAction<{ admin: AdminProfile; tokens: SessionTokens }>) {
      state.status = 'success';
      state.admin = action.payload.admin;
      state.accessToken = action.payload.tokens.accessToken;
      state.refreshToken = action.payload.tokens.refreshToken;
      state.accessTokenExpiresAt = action.payload.tokens.accessTokenExpiresAt;
      state.error = null;
    },
    tokensRefreshed(state, action: PayloadAction<SessionTokens>) {
      state.accessToken = action.payload.accessToken;
      state.refreshToken = action.payload.refreshToken;
      state.accessTokenExpiresAt = action.payload.accessTokenExpiresAt;
    },
    authFailed(state, action: PayloadAction<{ code: AdminErrorCode; message: string }>) {
      state.error = action.payload;
      state.status = action.payload.code === 'ACCOUNT_LOCKED' ? 'locked' : 'error';
    },
    bootstrapFinished(state) {
      state.bootstrapping = false;
    },
    signedOut() {
      return { ...initialState, bootstrapping: false };
    },
  },
});

export const { authStarted, sessionEstablished, tokensRefreshed, authFailed, bootstrapFinished, signedOut } = authSlice.actions;
export const authReducer = authSlice.reducer;

/** Single source of truth for "is this admin signed in" — never derived from `status` (see tenant-web's redirect-loop postmortem). */
export function selectIsAuthenticated(state: RootState): boolean {
  return state.auth.admin !== null;
}
