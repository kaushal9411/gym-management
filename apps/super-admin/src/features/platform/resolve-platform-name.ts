import { DEFAULT_PLATFORM_NAME } from './hooks/use-platform-config';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

interface PlatformConfigApiResponse {
  success: boolean;
  data: { appName: string } | null;
}

/**
 * Server-side counterpart to `usePlatformName()`, for `generateMetadata()`
 * (a Server Component context — `apiClient`'s axios instance pulls in the
 * client-only Redux store via `getActiveStore`, so it can't run here). A
 * plain `fetch()`, same pattern as tenant-web's `resolve.ts`.
 */
export async function resolvePlatformName(): Promise<string> {
  try {
    const res = await fetch(`${API_URL}/public/platform-config`, { cache: 'no-store' });
    if (!res.ok) return DEFAULT_PLATFORM_NAME;
    const body = (await res.json()) as PlatformConfigApiResponse;
    return body.success && body.data?.appName ? body.data.appName : DEFAULT_PLATFORM_NAME;
  } catch {
    return DEFAULT_PLATFORM_NAME;
  }
}
