/** Subdomains that can never be claimed by a tenant — they route to platform apps. */
export const RESERVED_SLUGS = new Set([
  'www', 'admin', 'api', 'app', 'mail', 'status', 'docs', 'cdn', 'assets',
  'help', 'blog', 'staging', 'ws', 'localhost', 'fitcloud', 'support',
]);

export const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])?$/;
