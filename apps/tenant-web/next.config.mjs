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
};

export default nextConfig;
