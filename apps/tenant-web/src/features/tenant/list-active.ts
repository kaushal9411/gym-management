/** Client-side counterpart to `resolve.ts` — used by `FindGymForm`'s gym picker (`GET /public/tenants`, no auth). */
export interface ActiveTenantOption {
  slug: string;
  name: string;
  logoUrl: string | null;
}

interface PublicTenantsApiResponse {
  success: boolean;
  data: ActiveTenantOption[];
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

/** Returns `[]` on any failure — the picker degrades to "no gyms found" rather than crashing the page. */
export async function listActiveTenants(): Promise<ActiveTenantOption[]> {
  try {
    const res = await fetch(`${API_URL}/public/tenants`, { cache: 'no-store' });
    if (!res.ok) return [];

    const body = (await res.json()) as PublicTenantsApiResponse;
    return body.success ? body.data : [];
  } catch {
    return [];
  }
}
