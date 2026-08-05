import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

import type { RootState } from '@/store';
import type { MemberAuthErrorCode, MemberAuthStatus, MemberProfile, MemberSessionTokens } from '../types';

interface MemberAuthState {
  status: MemberAuthStatus;
  bootstrapping: boolean;
  member: MemberProfile | null;
  accessToken: string | null;
  refreshToken: string | null;
  accessTokenExpiresAt: string | null;
  error: { code: MemberAuthErrorCode; message: string } | null;
}

const initialState: MemberAuthState = {
  status: 'idle',
  bootstrapping: true,
  member: null,
  accessToken: null,
  refreshToken: null,
  accessTokenExpiresAt: null,
  error: null,
};

/**
 * Deliberately its OWN slice + persist key (`memberAuth`, not `auth`) — a
 * member portal token must never be readable from/writable to the same
 * storage as a staff session, even though both live in this same Redux
 * store instance for simplicity. See member-api-client.ts for the matching
 * separate axios instance.
 */
const memberAuthSlice = createSlice({
  name: 'memberAuth',
  initialState,
  reducers: {
    memberAuthStarted(state) {
      state.status = 'loading';
      state.error = null;
    },
    memberSessionEstablished(state, action: PayloadAction<{ member: MemberProfile; tokens: MemberSessionTokens }>) {
      state.status = 'success';
      state.member = action.payload.member;
      state.accessToken = action.payload.tokens.accessToken;
      state.refreshToken = action.payload.tokens.refreshToken;
      state.accessTokenExpiresAt = action.payload.tokens.accessTokenExpiresAt;
      state.error = null;
    },
    memberTokensRefreshed(state, action: PayloadAction<MemberSessionTokens>) {
      state.accessToken = action.payload.accessToken;
      state.refreshToken = action.payload.refreshToken;
      state.accessTokenExpiresAt = action.payload.accessTokenExpiresAt;
    },
    memberAuthFailed(state, action: PayloadAction<{ code: MemberAuthErrorCode; message: string }>) {
      state.error = action.payload;
      state.status = action.payload.code === 'ACCOUNT_LOCKED' ? 'locked' : action.payload.code === 'ACCOUNT_SUSPENDED' ? 'suspended' : 'error';
    },
    memberBootstrapFinished(state) {
      state.bootstrapping = false;
    },
    memberAuthReset(state) {
      state.status = 'idle';
      state.error = null;
    },
    memberSignedOut() {
      return { ...initialState, bootstrapping: false };
    },
  },
});

export const {
  memberAuthStarted,
  memberSessionEstablished,
  memberTokensRefreshed,
  memberAuthFailed,
  memberBootstrapFinished,
  memberAuthReset,
  memberSignedOut,
} = memberAuthSlice.actions;

export const memberAuthReducer = memberAuthSlice.reducer;

export function selectIsMemberAuthenticated(state: RootState): boolean {
  return state.memberAuth.member !== null;
}
