import type { HealthBucket, ListQuery, ListSort, ListView } from '../../api/list';
import type { TenantStatus } from '../../types';

/** Filter state lives in the URL query string (single source of truth). Defaults are omitted from the URL. */
export interface ListFilters {
  q: string; status: TenantStatus | ''; plan: string; country: string; from: string; to: string;
  health: HealthBucket | ''; view: ListView | ''; tag: string; sort: ListSort; dir: 'asc' | 'desc'; page: number; limit: number;
}

export const DEFAULT_LIMIT = 25;
export const STATUSES: TenantStatus[] = ['ACTIVE', 'TRIAL', 'PAST_DUE', 'SUSPENDED', 'CANCELLED'];
export const VIEWS: ListView[] = ['trials_ending', 'at_risk', 'past_due', 'suspended', 'near_limits'];
export const HEALTHS: HealthBucket[] = ['at_risk', 'fair', 'healthy'];
export const SORTS: ListSort[] = ['mrr', 'createdAt', 'lastActiveAt', 'members', 'health', 'name'];
export const LIMITS = [25, 50, 100];

const pick = <T extends string>(v: string | null, all: readonly T[]): T | '' => (v && (all as readonly string[]).includes(v) ? (v as T) : '');
const date = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : '');

export function parseFilters(sp: URLSearchParams): ListFilters {
  const limit = Number(sp.get('limit'));
  return {
    q: sp.get('q') ?? '',
    status: pick(sp.get('status'), STATUSES),
    plan: sp.get('plan') ?? '',
    country: (sp.get('country') ?? '').toUpperCase().slice(0, 2),
    from: date(sp.get('from')), to: date(sp.get('to')),
    health: pick(sp.get('health'), HEALTHS),
    view: pick(sp.get('view'), VIEWS),
    tag: sp.get('tag') ?? '',
    sort: pick(sp.get('sort'), SORTS) || 'createdAt',
    dir: sp.get('dir') === 'asc' ? 'asc' : 'desc',
    page: Math.max(1, Math.floor(Number(sp.get('page'))) || 1),
    limit: LIMITS.includes(limit) ? limit : DEFAULT_LIMIT,
  };
}

export function toSearchString(f: ListFilters): string {
  const sp = new URLSearchParams();
  const set = (k: string, v: string | number, def: string | number = '') => { if (v !== def && v !== '') sp.set(k, String(v)); };
  set('q', f.q); set('status', f.status); set('plan', f.plan); set('country', f.country); set('from', f.from); set('to', f.to);
  set('health', f.health); set('view', f.view); set('tag', f.tag);
  set('sort', f.sort, 'createdAt'); set('dir', f.dir, 'desc'); set('page', f.page, 1); set('limit', f.limit, DEFAULT_LIMIT);
  return sp.toString();
}

export function toApiQuery(f: ListFilters): ListQuery {
  return {
    search: f.q || undefined, status: f.status || undefined, plan: f.plan || undefined, country: f.country || undefined,
    createdFrom: f.from || undefined, createdTo: f.to || undefined, health: f.health || undefined, view: f.view || undefined,
    tag: f.tag || undefined, sort: f.sort, sortDir: f.dir, page: f.page, limit: f.limit,
  };
}

/** Number of active narrowing filters (everything except sort/paging). */
export function activeFilterCount(f: ListFilters): number {
  return [f.q, f.status, f.plan, f.country, f.from, f.to, f.health, f.view, f.tag].filter(Boolean).length;
}
