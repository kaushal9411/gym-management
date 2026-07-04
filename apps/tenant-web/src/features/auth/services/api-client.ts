import axios from 'axios';

/**
 * PLACEHOLDER API client — configured but not yet used (mock services are
 * active until the backend lands). When HttpAuthService is wired in, this
 * instance already carries the platform conventions:
 *   • X-Tenant-Slug routing hint (authority stays with the JWT server-side)
 *   • withCredentials for the httpOnly refresh-token cookie
 *   • error normalization into the shared error-code catalog
 */
export const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? 'http://api.fitcloud.local/api/v1',
  timeout: 15_000,
  withCredentials: true,
});

apiClient.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const [subdomain] = window.location.hostname.split('.');
    if (subdomain) config.headers.set('X-Tenant-Slug', subdomain);
  }
  return config;
});

// Response interceptor (401 → silent refresh → retry) is added together
// with HttpAuthService when the real API is integrated.
