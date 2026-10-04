export interface RecentTenant { id: string; slug: string; name: string }
const KEY = 'fitcloud-sa-recent-tenants';
const MAX = 5;

/** Last-opened tenants (browser-local). Every access is try/catch'd — storage may be blocked. */
export function readRecentTenants(): RecentTenant[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed)
      ? parsed.filter((t): t is RecentTenant => !!t && typeof t === 'object' && typeof (t as RecentTenant).id === 'string' && typeof (t as RecentTenant).name === 'string').slice(0, MAX)
      : [];
  } catch {
    return [];
  }
}

export function pushRecentTenant(t: RecentTenant): void {
  try {
    const next = [t, ...readRecentTenants().filter((x) => x.id !== t.id)].slice(0, MAX);
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Not persisted — non-critical.
  }
}
