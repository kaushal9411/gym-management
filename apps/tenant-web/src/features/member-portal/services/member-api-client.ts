import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';

import { getCurrentTenantSlug } from '@/features/auth/utils/tenant-detection';
import { getActiveStore } from '@/store';
import { memberSignedOut } from '../store/member-auth-slice';
import { refreshMemberAccessToken } from './member-refresh-coordinator';
import { MemberAuthServiceError, type MemberAuthErrorCode } from '../types';
import { MEMBER_PORTAL_ROUTES } from '../constants';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

interface ApiErrorBody {
  success: false;
  message: string;
  errors: Array<{ field?: string; code?: string; message: string }> | null;
}

function buildErrorMessage(data: ApiErrorBody | undefined): string {
  const fieldErrors = (data?.errors ?? []).filter((e): e is { field: string; code?: string; message: string } => !!e.field);
  if (fieldErrors.length > 0) return fieldErrors.map((e) => `${e.field}: ${e.message}`).join('; ');
  return data?.message ?? 'Something went wrong. Please try again.';
}

function extractErrorCode(error: AxiosError<ApiErrorBody>): MemberAuthErrorCode {
  const backendCode = error.response?.data?.errors?.[0]?.code;
  const known: MemberAuthErrorCode[] = ['INVALID_CREDENTIALS', 'ACCOUNT_LOCKED', 'ACCOUNT_SUSPENDED', 'TOKEN_INVALID', 'TOKEN_EXPIRED', 'RATE_LIMITED'];
  if (backendCode && (known as string[]).includes(backendCode)) return backendCode as MemberAuthErrorCode;
  if (error.response?.status === 429) return 'RATE_LIMITED';
  return 'UNKNOWN';
}

export function toMemberAuthServiceError(error: unknown): MemberAuthServiceError {
  if (error instanceof MemberAuthServiceError) return error;
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<ApiErrorBody>;
    if (!axiosError.response) return new MemberAuthServiceError('UNKNOWN', 'Network error — check your connection and try again.');
    return new MemberAuthServiceError(extractErrorCode(axiosError), buildErrorMessage(axiosError.response.data));
  }
  return new MemberAuthServiceError('UNKNOWN', 'Something went wrong. Please try again.');
}

/**
 * A separate axios instance from `apiClient` (the staff one) on purpose —
 * reads the `memberAuth` slice's token, never `auth`'s. Simpler than the
 * staff client deliberately (no request-cancel-dedup, no auto-retry-on-5xx)
 * — this portal doesn't yet have the traffic patterns that justified those.
 */
export const memberApiClient = axios.create({ baseURL: API_BASE_URL, timeout: 15_000 });

memberApiClient.interceptors.request.use((config) => {
  const slug = getCurrentTenantSlug();
  if (slug) config.headers.set('X-Tenant-Slug', slug);
  const token = getActiveStore()?.getState().memberAuth.accessToken;
  if (token) config.headers.set('Authorization', `Bearer ${token}`);
  return config;
});

memberApiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiErrorBody>) => {
    const config = error.config;
    const authError = toMemberAuthServiceError(error);

    const retriable = config as (InternalAxiosRequestConfig & { _retried?: boolean }) | undefined;
    const isRefreshCall = config?.url?.includes('/member/auth/refresh');

    if (error.response?.status === 401 && authError.code === 'TOKEN_EXPIRED' && retriable && !retriable._retried && !isRefreshCall) {
      const refreshed = await refreshMemberAccessToken();
      if (refreshed) {
        retriable._retried = true;
        retriable.headers.set('Authorization', `Bearer ${refreshed.accessToken}`);
        return memberApiClient(retriable);
      }
      getActiveStore()?.dispatch(memberSignedOut());
      if (typeof window !== 'undefined') window.location.assign(MEMBER_PORTAL_ROUTES.login);
      return Promise.reject(authError);
    }

    if (error.response?.status === 401 && (authError.code === 'TOKEN_INVALID' || isRefreshCall)) {
      getActiveStore()?.dispatch(memberSignedOut());
      if (typeof window !== 'undefined' && window.location.pathname !== MEMBER_PORTAL_ROUTES.login) {
        window.location.assign(MEMBER_PORTAL_ROUTES.login);
      }
    }

    return Promise.reject(authError);
  },
);
