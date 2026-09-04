const PLATFORM_DOMAIN = process.env.NEXT_PUBLIC_PLATFORM_DOMAIN ?? 'fitcloud.local';

/**
 * Builds the target subdomain URL from the CURRENT host, so this works
 * identically in every environment without hardcoding a domain: on
 * `{x}.localhost:3001` or plain `localhost:3001` it targets
 * `{slug}.localhost:<port>` (browser-native dev subdomains); anywhere else
 * it targets `{slug}.<platform domain>`.
 */
export function buildTenantLoginUrl(slug: string): string {
  const { protocol, hostname, port } = window.location;
  const isLocalDev = hostname === 'localhost' || hostname.endsWith('.localhost');
  const host = isLocalDev ? `${slug}.localhost${port ? `:${port}` : ''}` : `${slug}.${PLATFORM_DOMAIN}`;
  return `${protocol}//${host}/login`;
}

/** The reverse of `buildTenantLoginUrl` — strips the current tenant subdomain back down to the bare platform host, for the tenant login screen's "Change gym" link. */
export function buildPlatformLoginUrl(): string {
  const { protocol, hostname, port } = window.location;
  const isLocalDev = hostname === 'localhost' || hostname.endsWith('.localhost');
  const bareHost = isLocalDev ? `localhost${port ? `:${port}` : ''}` : PLATFORM_DOMAIN;
  return `${protocol}//${bareHost}/login`;
}
