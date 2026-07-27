import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';

import { getActiveStore } from '@/store';
import { requestFinished, requestStarted } from '@/store/ui-slice';
import { signedOut } from '../store/auth-slice';
import { getCurrentTenantSlug } from '../utils/tenant-detection';
import { AUTH_ROUTES } from '../constants';
import { AuthServiceError, type AuthErrorCode } from '../types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

/** Redirect targets for tenant-wide failures that can surface from ANY endpoint, not just auth. */
const TENANT_ERROR_REDIRECTS: Partial<Record<AuthErrorCode, string>> = {
  TENANT_SUSPENDED: AUTH_ROUTES.accountSuspended,
  SUBSCRIPTION_EXPIRED: AUTH_ROUTES.subscriptionExpired,
  TRIAL_EXPIRED: AUTH_ROUTES.trialExpired,
  MAINTENANCE: AUTH_ROUTES.maintenance,
};

interface ApiErrorBody {
  success: false;
  message: string;
  errors: Array<{ field?: string; code?: string; message: string }> | null;
}

/** `validityStart` -> "Validity Start"; `staffProfile.dateOfBirth` -> "Date Of Birth" (last path segment — the leaf is what the user actually typed into). */
function humanizeField(field: string): string {
  const leaf = field.split('.').pop() ?? field;
  return leaf
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/^./, (c) => c.toUpperCase());
}

/**
 * Builds a specific, actionable message from the backend's per-field `errors[]`
 * (present on every `ValidationError` — see `core/errors/app-error.ts` +
 * `core/middleware/validate.middleware.ts` on the API) instead of the generic
 * top-level `message` ("Request validation failed") that collapses every
 * field into one useless string. Falls back to the top-level message for
 * non-validation errors (no `field` on any entry) so this is a pure
 * improvement, not a behavior change, for every other error shape.
 */
function buildErrorMessage(data: ApiErrorBody | undefined): string {
  const fieldErrors = (data?.errors ?? []).filter((e): e is { field: string; code?: string; message: string } => !!e.field);
  if (fieldErrors.length > 0) {
    return fieldErrors.map((e) => `${humanizeField(e.field)}: ${e.message}`).join('; ');
  }
  return data?.message ?? 'Something went wrong. Please try again.';
}

/** Extracts the backend's stable error code, falling back to a status-derived guess. */
function extractErrorCode(error: AxiosError<ApiErrorBody>): AuthErrorCode {
  const backendCode = error.response?.data?.errors?.[0]?.code;
  const known: AuthErrorCode[] = [
    'INVALID_CREDENTIALS', 'ACCOUNT_LOCKED', 'ACCOUNT_SUSPENDED', 'TENANT_SUSPENDED',
    'SUBSCRIPTION_EXPIRED', 'TRIAL_EXPIRED', 'SESSION_EXPIRED', 'EMAIL_NOT_VERIFIED',
    'OTP_INVALID', 'OTP_EXPIRED', 'TOKEN_INVALID', 'TOKEN_EXPIRED', 'SLUG_TAKEN',
    'RATE_LIMITED', 'MAINTENANCE',
  ];
  if (backendCode && (known as string[]).includes(backendCode)) return backendCode as AuthErrorCode;
  if (error.response?.status === 429) return 'RATE_LIMITED';
  return 'UNKNOWN';
}

export function toAuthServiceError(error: unknown): AuthServiceError {
  if (error instanceof AuthServiceError) return error;
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<ApiErrorBody>;
    if (axiosError.code === 'ECONNABORTED') {
      return new AuthServiceError('UNKNOWN', 'Request timed out — please try again.');
    }
    if (!axiosError.response) {
      return new AuthServiceError('UNKNOWN', 'Network error — check your connection and try again.');
    }
    const code = extractErrorCode(axiosError);
    const message = buildErrorMessage(axiosError.response.data);
    return new AuthServiceError(code, message);
  }
  return new AuthServiceError('UNKNOWN', 'Something went wrong. Please try again.');
}

function attachTenantHeader(config: InternalAxiosRequestConfig): void {
  const slug = getCurrentTenantSlug();
  if (slug) config.headers.set('X-Tenant-Slug', slug);
}

function attachAuthHeader(config: InternalAxiosRequestConfig): void {
  const token = getActiveStore()?.getState().auth.accessToken;
  if (token) config.headers.set('Authorization', `Bearer ${token}`);
}

// ── Cancel-duplicate-requests: an identical in-flight request (same
// method+url+params) is aborted in favor of the newest one — prevents
// races from rapid re-submits (double-click, fast typing, etc). ──
const inFlight = new Map<string, AbortController>();

function requestKey(config: InternalAxiosRequestConfig): string {
  return `${config.method}:${config.url}:${JSON.stringify(config.params ?? {})}`;
}

// ── Automatic retry for transient network failures (Prompt 23: Global
// Loading & Performance Optimization) — GET requests only. Retrying a
// POST/PATCH/PUT/DELETE automatically would risk a duplicate side effect
// (e.g. double-creating a record) if the original request actually reached
// the server and only the response was lost; a failed read has no such
// risk, so only idempotent GETs auto-retry. Exponential backoff, capped at
// 2 attempts. ──
const MAX_RETRIES = 2;
const RETRY_BASE_DELAY_MS = 500;

function isRetriableError(error: AxiosError): boolean {
  if (error.config?.method?.toLowerCase() !== 'get') return false;
  if (error.code === 'ECONNABORTED') return true; // client-side timeout
  if (!error.response) return true; // network failure — no response at all
  return error.response.status >= 500; // transient server-side failure
}

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15_000,
  withCredentials: true,
});

apiClient.interceptors.request.use((config) => {
  attachTenantHeader(config);
  attachAuthHeader(config);

  const key = requestKey(config);
  inFlight.get(key)?.abort();
  const controller = new AbortController();
  inFlight.set(key, controller);
  config.signal = controller.signal;

  getActiveStore()?.dispatch(requestStarted());
  return config;
});

apiClient.interceptors.response.use(
  (response) => {
    inFlight.delete(requestKey(response.config));
    getActiveStore()?.dispatch(requestFinished());
    return response;
  },
  async (error: AxiosError<ApiErrorBody>) => {
    const config = error.config;
    if (config) {
      inFlight.delete(requestKey(config));
      getActiveStore()?.dispatch(requestFinished());
    }

    if (axios.isCancel(error)) return Promise.reject(error);

    if (config && isRetriableError(error)) {
      const retriableConfig = config as InternalAxiosRequestConfig & { _retryCount?: number };
      const retryCount = retriableConfig._retryCount ?? 0;
      if (retryCount < MAX_RETRIES) {
        retriableConfig._retryCount = retryCount + 1;
        const delayMs = RETRY_BASE_DELAY_MS * 2 ** retryCount;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        return apiClient(retriableConfig);
      }
    }

    const authError = toAuthServiceError(error);

    // Tenant-wide failures can come back from ANY endpoint — handle them
    // globally so every call site doesn't need its own special case.
    const redirect = TENANT_ERROR_REDIRECTS[authError.code];
    if (redirect && typeof window !== 'undefined') {
      const path = window.location.pathname;
      // Expiry is recoverable via the billing rescue path: while the user
      // is on /billing (paying their way back in) or already on the status
      // page, background 402s must not yank them away mid-checkout.
      const isExpiryCode = authError.code === 'TRIAL_EXPIRED' || authError.code === 'SUBSCRIPTION_EXPIRED';
      const inRescueArea = isExpiryCode && path.startsWith('/billing');
      if (!inRescueArea && path !== redirect) {
        window.location.assign(redirect);
      }
      return Promise.reject(authError);
    }

    // Access token expired mid-session — refresh once and retry, unless
    // this WAS the refresh call itself (avoid infinite loop) or we've
    // already retried this request once.
    const retriable = config as (InternalAxiosRequestConfig & { _retried?: boolean }) | undefined;
    const isRefreshCall = config?.url?.includes('/auth/refresh');
    if (
      error.response?.status === 401 &&
      authError.code === 'TOKEN_EXPIRED' &&
      retriable &&
      !retriable._retried &&
      !isRefreshCall
    ) {
      const { refreshAccessToken } = await import('./refresh-coordinator');
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        retriable._retried = true;
        retriable.headers.set('Authorization', `Bearer ${refreshed.accessToken}`);
        return apiClient(retriable);
      }
      getActiveStore()?.dispatch(signedOut());
      if (typeof window !== 'undefined') window.location.assign(AUTH_ROUTES.sessionExpired);
      return Promise.reject(authError);
    }

    // Refresh token itself is dead (expired/reused/invalid) — session is truly over.
    if (error.response?.status === 401 && (authError.code === 'TOKEN_INVALID' || isRefreshCall)) {
      getActiveStore()?.dispatch(signedOut());
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith(AUTH_ROUTES.sessionExpired)) {
        window.location.assign(AUTH_ROUTES.sessionExpired);
      }
    }

    return Promise.reject(authError);
  },
);
