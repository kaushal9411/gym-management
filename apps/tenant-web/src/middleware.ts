import { NextResponse, type NextRequest } from 'next/server';

/**
 * Subdomain-as-tenant resolution.
 *
 * goldgym.fitcloud.com → x-tenant-slug: goldgym, read once by the root
 * layout (server) and turned into branding. Users NEVER pick a tenant.
 *
 * Dev conveniences (only meaningful off the wildcard domain):
 *   • goldgym.localhost:3001 works natively in modern browsers
 *   • ?tenant=goldgym pins the slug in a cookie for plain localhost
 */
const PLATFORM_DOMAIN = process.env.NEXT_PUBLIC_PLATFORM_DOMAIN ?? 'fitcloud.local';
const RESERVED_SUBDOMAINS = new Set([
  'www', 'admin', 'api', 'app', 'mail', 'status', 'docs', 'cdn', 'assets', 'help', 'blog', 'staging', 'ws',
]);
const TENANT_COOKIE = 'x-dev-tenant';

function extractSlugFromHost(host: string): string | null {
  const hostname = host.split(':')[0]?.toLowerCase() ?? '';

  // {slug}.localhost — browser-native dev subdomains
  if (hostname.endsWith('.localhost')) {
    const label = hostname.slice(0, -'.localhost'.length);
    return label && !RESERVED_SUBDOMAINS.has(label) ? label : null;
  }

  // {slug}.<platform domain> — production & nginx dev proxy
  if (hostname.endsWith(`.${PLATFORM_DOMAIN}`)) {
    const label = hostname.slice(0, -(PLATFORM_DOMAIN.length + 1));
    return label && !label.includes('.') && !RESERVED_SUBDOMAINS.has(label) ? label : null;
  }

  return null;
}

export function middleware(request: NextRequest): NextResponse {
  const devOverride = request.nextUrl.searchParams.get('tenant');
  const slug =
    extractSlugFromHost(request.headers.get('host') ?? '') ??
    devOverride ??
    request.cookies.get(TENANT_COOKIE)?.value ??
    null;

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-tenant-slug', slug ?? '');

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  if (devOverride) {
    response.cookies.set(TENANT_COOKIE, devOverride, { path: '/', sameSite: 'lax' });
  }
  return response;
}

export const config = {
  // Everything except static assets and images
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
