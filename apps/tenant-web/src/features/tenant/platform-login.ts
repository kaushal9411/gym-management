import { buildTenantLoginUrl, buildTenantUrl } from './subdomain-urls';

/**
 * Login from the bare/platform host (no gym in the address). The visitor types
 * an email / Member ID + password; `discoverGyms` finds which gym(s) those
 * credentials belong to (`POST /public/auth/discover-gyms`), and
 * `continueToGym` takes them into the chosen gym's own subdomain.
 * `requestPasswordResetAnywhere` is the gym-less "Forgot password?" counterpart.
 */
export interface DiscoveredGym {
  slug: string;
  name: string;
  logoUrl: string | null;
}

/** Plain, user-presentable failure — the platform host has no auth store/axios client to normalise errors for us. */
export class PlatformLoginError extends Error {
  constructor(
    message: string,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'PlatformLoginError';
  }
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';
const GENERIC_ERROR = 'Something went wrong. Please try again.';

interface ApiEnvelope<T> {
  success: boolean;
  message?: string;
  data: T;
  errors?: Array<{ code?: string; message: string }> | null;
}

async function postJson<T>(path: string, body: unknown, headers: Record<string, string> = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
      cache: 'no-store',
    });
  } catch {
    throw new PlatformLoginError('Could not reach the server. Check your connection and try again.');
  }

  const envelope = (await res.json().catch(() => null)) as ApiEnvelope<T> | null;
  if (!res.ok || !envelope?.success) {
    throw new PlatformLoginError(envelope?.errors?.[0]?.message ?? envelope?.message ?? GENERIC_ERROR, envelope?.errors?.[0]?.code);
  }
  return envelope.data;
}

/** Gyms where this identifier + password verify. Never empty — no match is a `PlatformLoginError` (INVALID_CREDENTIALS). */
export async function discoverGyms(input: { actorType: 'staff' | 'member'; identifier: string; password: string }): Promise<DiscoveredGym[]> {
  const data = await postJson<{ gyms: DiscoveredGym[] }>('/public/auth/discover-gyms', input);
  return data.gyms;
}

/**
 * Forgot password without knowing the gym (`POST /public/auth/forgot-password`, no auth, no tenant header).
 * The server mails a reset link for every gym the identifier (staff email or Member ID) exists in and always
 * answers 200 with a generic message, so success never says whether an account exists. Throws a
 * `PlatformLoginError` only for rate limiting / validation / network failures.
 */
export async function requestPasswordResetAnywhere(identifier: string): Promise<void> {
  await postJson<unknown>('/public/auth/forgot-password', { identifier: identifier.trim() });
}

interface StaffTokens {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: string;
}

/**
 * Where to send the visitor once a gym is chosen.
 *
 * - **Staff, no 2FA**: the real login runs right here (with the gym's
 *   `X-Tenant-Slug`) and the tokens are handed to the gym subdomain via the
 *   same URL-fragment handoff the registration wizard uses (see
 *   `features/onboarding/utils/portal-url.ts` for the security rationale) —
 *   the user lands signed in without typing the password again.
 * - **Everyone else** (members, or staff whose account needs a 2FA / MFA-setup
 *   step): the gym's own login page, with the identifier prefilled so only
 *   the password is typed again. Those flows live on the subdomain.
 *
 * A bad password / locked / suspended account throws a `PlatformLoginError`.
 */
export async function continueToGym(input: {
  slug: string;
  actorType: 'staff' | 'member';
  identifier: string;
  password: string;
  rememberMe: boolean;
}): Promise<string> {
  const fallback = `${buildTenantLoginUrl(input.slug)}?identifier=${encodeURIComponent(input.identifier)}`;
  if (input.actorType === 'member') return fallback;

  const data = await postJson<StaffTokens | { challenge: string }>(
    '/auth/login',
    { email: input.identifier, password: input.password, rememberMe: input.rememberMe },
    { 'X-Tenant-Slug': input.slug },
  );
  if ('challenge' in data) return fallback;

  const fragment = new URLSearchParams({
    at: data.accessToken,
    rt: data.refreshToken,
    exp: data.accessTokenExpiresAt,
  }).toString();
  return `${buildTenantUrl(input.slug, '/onboarding-complete')}#${fragment}`;
}
