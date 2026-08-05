import axios from 'axios';

import { getActiveStore } from '@/store';
import { getCurrentTenantSlug } from '@/features/auth/utils/tenant-detection';
import { memberTokensRefreshed } from '../store/member-auth-slice';
import type { MemberSessionTokens } from '../types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

/** No response interceptor — a failed refresh must never recursively trigger another refresh attempt. */
const refreshOnlyClient = axios.create({ baseURL: API_BASE_URL, timeout: 15_000 });

interface RefreshResponseBody {
  success: boolean;
  data: MemberSessionTokens | null;
}

/** Deduplicated — two 401s at once must only rotate the refresh token once (the member-auth backend revokes the whole session family on reuse, same as the staff plane). */
let inFlightRefresh: Promise<MemberSessionTokens | null> | null = null;

export async function refreshMemberAccessToken(): Promise<MemberSessionTokens | null> {
  inFlightRefresh ??= performRefresh().finally(() => {
    inFlightRefresh = null;
  });
  return inFlightRefresh;
}

async function performRefresh(): Promise<MemberSessionTokens | null> {
  const store = getActiveStore();
  const refreshToken = store?.getState().memberAuth.refreshToken;
  if (!store || !refreshToken) return null;

  try {
    const slug = getCurrentTenantSlug();
    const res = await refreshOnlyClient.post<RefreshResponseBody>(
      '/member/auth/refresh',
      { refreshToken },
      { headers: slug ? { 'X-Tenant-Slug': slug } : undefined },
    );
    if (!res.data.success || !res.data.data) return null;

    store.dispatch(memberTokensRefreshed(res.data.data));
    return res.data.data;
  } catch {
    return null;
  }
}
