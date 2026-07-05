import axios from 'axios';

import { getActiveStore } from '@/store';
import { tokensRefreshed } from '../store/auth-slice';
import { getCurrentTenantSlug } from '../utils/tenant-detection';
import type { SessionTokens } from '../types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

/**
 * A bare axios instance with NO response interceptor — used only for the
 * refresh call itself, so a failed refresh can never recursively trigger
 * another refresh attempt (which `apiClient`'s interceptor would do).
 */
const refreshOnlyClient = axios.create({ baseURL: API_BASE_URL, timeout: 15_000 });

interface RefreshResponseBody {
  success: boolean;
  data: { accessToken: string; accessTokenExpiresAt: string; refreshToken: string } | null;
}

/**
 * Deduplicated token refresh. If two requests hit a 401 at the same
 * moment, only ONE `/auth/refresh` call is made — the second caller
 * awaits the same in-flight promise instead of racing a second rotation
 * (which would revoke the first one's new token, per reuse detection).
 */
let inFlightRefresh: Promise<SessionTokens | null> | null = null;

export async function refreshAccessToken(): Promise<SessionTokens | null> {
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
    const slug = getCurrentTenantSlug();
    const res = await refreshOnlyClient.post<RefreshResponseBody>(
      '/auth/refresh',
      { refreshToken },
      { headers: slug ? { 'X-Tenant-Slug': slug } : undefined },
    );

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
