const isDev = process.env.NODE_ENV !== 'production';

// Same-origin app requests never need this explicitly (`'self'` already
// covers them) — this exists only so a misconfigured deploy pointing
// `NEXT_PUBLIC_API_URL` at a genuinely different host still has that host
// allow-listed for `connect-src`/`img-src` rather than silently CSP-blocking
// every API call. Also derives the matching `ws(s)://` origin — Socket.IO
// (`features/realtime/socket-client.ts`) connects to this same host for
// live notifications, and a browser's CSP does NOT treat
// `connect-src http://host` as covering a `ws://host` upgrade to that same
// host; without this explicit ws(s) entry every WebSocket connection is
// silently blocked (confirmed live — caught by a real Playwright
// console-error check, not by inspection).
const { httpOrigin: apiOrigin, wsOrigin: apiWsOrigin } = (() => {
  try {
    const url = new URL(process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1');
    return { httpOrigin: url.origin, wsOrigin: `${url.protocol === 'https:' ? 'wss:' : 'ws:'}//${url.host}` };
  } catch {
    return { httpOrigin: "'self'", wsOrigin: "'self'" };
  }
})();

/**
 * `'unsafe-eval'` is dev-only — Next.js Fast Refresh/webpack HMR uses
 * `eval()` for source-mapped module updates, and a CSP without it breaks
 * `next dev` outright (not just a lint nit — the page fails to hydrate).
 * `'unsafe-inline'` for both script-src and style-src is a deliberate,
 * documented trade-off rather than the "textbook" nonce-based CSP: this
 * app paints per-tenant branding as an inline `style` ATTRIBUTE on `<body>`
 * (`app/layout.tsx`), and CSP nonces only cover `<style>`/`<script>`
 * ELEMENTS, never inline attributes — so `style-src` needs `'unsafe-inline'`
 * regardless of how strict `script-src` gets, which removes most of the
 * benefit a full nonce rollout would buy here.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  // Images can legitimately come from any real S3/CDN bucket in prod (no
  // per-tenant allow-list is practical) — a mislabeled image can't execute
  // script even so, and every upload is now magic-byte-verified server-side
  // (see core/storage/file-signature.util.ts), so this is a low-risk relaxation.
  `img-src 'self' data: blob: https: http://localhost:9000`,
  "font-src 'self' data:",
  `connect-src 'self' ${apiOrigin} ${apiWsOrigin}`,
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
].join('; ');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  eslint: {
    // Linting runs as a dedicated turbo/CI task (`pnpm lint`), not inside the build.
    ignoreDuringBuilds: true,
  },
  // Global Loading & Performance Optimization (Prompt 23) — lets Next.js
  // tree-shake per-icon/per-chart imports from these two large barrel-file
  // libraries instead of pulling the whole package into every chunk that
  // imports from them (both are used on nearly every page in this app).
  // No behavior change, just smaller bundles.
  experimental: {
    optimizePackageImports: ['lucide-react', 'recharts'],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // `camera=(self)` — the attendance QR scanner (`getUserMedia`) needs it; everything else this app doesn't use is denied outright.
          { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default nextConfig;
