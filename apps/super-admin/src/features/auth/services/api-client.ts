import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';

import { getActiveStore } from '@/store';
import { signedOut } from '../store/auth-slice';
import { AdminServiceError, type AdminErrorCode } from '../types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

interface ApiErrorBody {
  success: false;
  message: string;
  errors: Array<{ field?: string; code?: string; message: string }> | null;
}

const KNOWN_CODES: AdminErrorCode[] = ['INVALID_CREDENTIALS', 'ACCOUNT_LOCKED', 'ACCOUNT_SUSPENDED', 'SESSION_EXPIRED', 'TOKEN_INVALID', 'TOKEN_EXPIRED', 'FORBIDDEN', 'RATE_LIMITED'];

function extractErrorCode(error: AxiosError<ApiErrorBody>): AdminErrorCode {
  const backendCode = error.response?.data?.errors?.[0]?.code;
  if (backendCode && (KNOWN_CODES as string[]).includes(backendCode)) return backendCode as AdminErrorCode;
  if (error.response?.status === 429) return 'RATE_LIMITED';
  if (error.response?.status === 403) return 'FORBIDDEN';
  return 'UNKNOWN';
}

export function toAdminServiceError(error: unknown): AdminServiceError {
  if (error instanceof AdminServiceError) return error;
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<ApiErrorBody>;
    if (!axiosError.response) return new AdminServiceError('UNKNOWN', 'Network error — check your connection and try again.');
    const code = extractErrorCode(axiosError);
    const message = axiosError.response.data?.message ?? 'Something went wrong. Please try again.';
    return new AdminServiceError(code, message);
  }
  return new AdminServiceError('UNKNOWN', 'Something went wrong. Please try again.');
}

function attachAuthHeader(config: InternalAxiosRequestConfig): void {
  const token = getActiveStore()?.getState().auth.accessToken;
  if (token) config.headers.set('Authorization', `Bearer ${token}`);
}

const inFlight = new Map<string, AbortController>();
const requestKey = (config: InternalAxiosRequestConfig) => `${config.method}:${config.url}:${JSON.stringify(config.params ?? {})}`;

export const apiClient = axios.create({ baseURL: API_BASE_URL, timeout: 15_000 });

apiClient.interceptors.request.use((config) => {
  attachAuthHeader(config);
  const key = requestKey(config);
  inFlight.get(key)?.abort();
  const controller = new AbortController();
  inFlight.set(key, controller);
  config.signal = controller.signal;
  return config;
});

apiClient.interceptors.response.use(
  (response) => {
    inFlight.delete(requestKey(response.config));
    return response;
  },
  async (error: AxiosError<ApiErrorBody>) => {
    if (error.config) inFlight.delete(requestKey(error.config));
    if (axios.isCancel(error)) return Promise.reject(error);

    const adminError = toAdminServiceError(error);
    const retriable = error.config as (InternalAxiosRequestConfig & { _retried?: boolean }) | undefined;
    const isRefreshCall = error.config?.url?.includes('/admin/auth/refresh');

    if (error.response?.status === 401 && adminError.code === 'TOKEN_EXPIRED' && retriable && !retriable._retried && !isRefreshCall) {
      const { refreshAdminAccessToken } = await import('./refresh-coordinator');
      const refreshed = await refreshAdminAccessToken();
      if (refreshed) {
        retriable._retried = true;
        retriable.headers.set('Authorization', `Bearer ${refreshed.accessToken}`);
        return apiClient(retriable);
      }
      getActiveStore()?.dispatch(signedOut());
      if (typeof window !== 'undefined') window.location.assign('/session-expired');
      return Promise.reject(adminError);
    }

    if (error.response?.status === 401 && (adminError.code === 'TOKEN_INVALID' || isRefreshCall)) {
      getActiveStore()?.dispatch(signedOut());
      if (typeof window !== 'undefined' && window.location.pathname !== '/login') window.location.assign('/login');
    }

    return Promise.reject(adminError);
  },
);
