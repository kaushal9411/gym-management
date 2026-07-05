/**
 * Client-side mirror of `middleware.ts`'s subdomain extraction — used by
 * the axios client (to stamp every request with X-Tenant-Slug) and the
 * `useTenant()` hook family. Never asks the user to pick a tenant: the
 * slug is always derived from the URL itself.
 *
 *   goldgym.fitcloud.com   → goldgym
 *   goldgym.localhost:3001 → goldgym   (dev — browsers resolve *.localhost natively)
 *   localhost:3001         → null      (platform host, no tenant)
 */
const RESERVED_SUBDOMAINS = new Set([
  'www', 'admin', 'api', 'app', 'mail', 'status', 'docs', 'cdn', 'assets',
  'help', 'blog', 'staging', 'ws', 'localhost', 'fitcloud',
]);

export function extractTenantSlug(hostname: string): string | null {
  const host = hostname.toLowerCase();

  if (host.endsWith('.localhost')) {
    const label = host.slice(0, -'.localhost'.length);
    return label && !RESERVED_SUBDOMAINS.has(label) ? label : null;
  }

  const platformDomain = process.env.NEXT_PUBLIC_PLATFORM_DOMAIN ?? 'fitcloud.local';
  const domains = [platformDomain, 'fitcloud.com'];
  for (const domain of domains) {
    if (host.endsWith(`.${domain}`)) {
      const label = host.slice(0, -(domain.length + 1));
      if (label && !label.includes('.') && !RESERVED_SUBDOMAINS.has(label)) return label;
    }
  }

  return null;
}

/** Reads the slug from `window.location` — client components/modules only. */
export function getCurrentTenantSlug(): string | null {
  if (typeof window === 'undefined') return null;
  return extractTenantSlug(window.location.hostname);
}
