/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  eslint: {
    // Linting runs as a dedicated turbo/CI task (`pnpm lint`), not inside the build.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
