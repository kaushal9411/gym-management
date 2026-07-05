interface HandoffTokens {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: string;
}

/**
 * Builds the URL that hands a freshly-provisioned owner off to their new
 * tenant subdomain, already signed in. The tenant portal is a DIFFERENT
 * origin than the onboarding wizard (`{slug}.localhost:3001` vs bare
 * `localhost:3001`, or `{slug}.fitcloud.com` in production) — browser
 * storage is origin-scoped, so tokens obtained here cannot simply be
 * written to localStorage and carried over by a normal redirect.
 *
 * SECURITY TRADEOFF (documented, not accidental): tokens are passed via the
 * URL fragment, never the query string or path — fragments are not sent to
 * any server in the HTTP request line, so they never hit access logs. The
 * landing page at `/onboarding-complete` (see app/(auth)/onboarding-complete)
 * reads the fragment once, immediately calls `history.replaceState` to
 * scrub it, and exchanges it for a normal Redux/redux-persist session on
 * that origin. This mirrors the same accepted, documented risk posture as
 * storing tokens in localStorage (see store/index.ts) — the exposure window
 * is one client-side redirect, not an ongoing storage location.
 */
export function buildOnboardingHandoffUrl(slug: string, backendPortalUrl: string, tokens: HandoffTokens): string {
  const isLocalDev =
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname.endsWith('.localhost'));

  const base = isLocalDev
    ? `${window.location.protocol}//${slug}.localhost${window.location.port ? `:${window.location.port}` : ''}`
    : backendPortalUrl;

  const fragment = new URLSearchParams({
    at: tokens.accessToken,
    rt: tokens.refreshToken,
    exp: tokens.accessTokenExpiresAt,
  }).toString();

  return `${base}/onboarding-complete#${fragment}`;
}
