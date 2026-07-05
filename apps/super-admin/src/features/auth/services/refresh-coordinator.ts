import axios from 'axios';

import { getActiveStore } from '@/store';
import { tokensRefreshed } from '../store/auth-slice';
import type { SessionTokens } from '../types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

const refreshOnlyClient = axios.create({ baseURL: API_BASE_URL, timeout: 15_000 });

interface RefreshResponseBody {
  success: boolean;
  data: { accessToken: string; accessTokenExpiresAt: string; refreshToken: string } | null;
}

let inFlightRefresh: Promise<SessionTokens | null> | null = null;

export async function refreshAdminAccessToken(): Promise<SessionTokens | null> {
  inFlightRefresh ??= performRefresh().finally(() => {
    inFlightRefresh = null;
  });
  return inFlightRefresh;
}

async function performRefresh(): Promise<SessionTokens | null> {
  const store = getActiveStore();
  const refreshToken = store?.getState().auth.refreshToken;
  if (!store || !refreshToken) return null;

  try {
    const res = await refreshOnlyClient.post<RefreshResponseBody>('/admin/auth/refresh', { refreshToken });
    if (!res.data.success || !res.data.data) return null;

    const tokens: SessionTokens = {
      accessToken: res.data.data.accessToken,
      refreshToken: res.data.data.refreshToken,
      accessTokenExpiresAt: res.data.data.accessTokenExpiresAt,
    };
    store.dispatch(tokensRefreshed(tokens));
    return tokens;
  } catch {
    return null;
  }
}
