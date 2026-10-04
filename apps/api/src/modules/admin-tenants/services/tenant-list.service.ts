import { tenantListRepository } from '../repositories/tenant-list.repository';
import { healthDistribution } from '../utils/tenant-health.util';
import {
  EXPORT_ROW_CAP,
  applyMemoryFilters,
  buildGrowth,
  buildPlanMix,
  buildRenewals,
  computeCounts,
  lastMonths,
  scoreTenant,
  sortTenants,
  toListItem,
  toSqlFilters,
  type ListFilters,
  type ScoredTenant,
  type TenantSort,
} from '../utils/tenant-list.util';

import { findTenantIdsByTags, getTenantTagsMap } from './tenant-notes.service';

export interface ListParams extends ListFilters {
  sort?: TenantSort;
  sortDir?: 'asc' | 'desc';
  page: number;
  limit: number;
}

const DAY_MS = 86_400_000;

export class TenantListService {
  private async scored(filters: ListFilters, now: Date): Promise<ScoredTenant[]> {
    const facts = await tenantListRepository.loadFacts(toSqlFilters(filters), now);
    return facts.map((t) => scoreTenant(t, now));
  }

  async list(params: ListParams) {
    const now = new Date();
    const all = await this.scored(params, now);
    const tagIds = params.tag ? new Set(await findTenantIdsByTags([params.tag])) : null;
    const filtered = sortTenants(
      applyMemoryFilters(all, params, now, tagIds),
      params.sort ?? 'createdAt',
      params.sortDir ?? 'desc',
    );
    const skip = (params.page - 1) * params.limit;
    const pageRows = filtered.slice(skip, skip + params.limit);
    const tags = await getTenantTagsMap(pageRows.map((r) => r.id));
    return {
      items: pageRows.map((r) => toListItem(r, tags.get(r.id) ?? [])),
      page: params.page,
      limit: params.limit,
      total: filtered.length,
      totalPages: Math.ceil(filtered.length / params.limit),
      counts: computeCounts(all, now),
    };
  }

  /** All matching rows (same filters/sort as the list), capped at 5,000, for the CSV export. */
  async exportRows(params: ListFilters & { sort?: TenantSort; sortDir?: 'asc' | 'desc' }) {
    const now = new Date();
    const all = await this.scored(params, now);
    const tagIds = params.tag ? new Set(await findTenantIdsByTags([params.tag])) : null;
    const rows = sortTenants(
      applyMemoryFilters(all, params, now, tagIds),
      params.sort ?? 'createdAt',
      params.sortDir ?? 'desc',
    );
    const capped = rows.slice(0, EXPORT_ROW_CAP);
    return {
      rows: capped,
      total: rows.length,
      tags: await getTenantTagsMap(capped.map((r) => r.id)),
    };
  }

  async tags() {
    return tenantListRepository.tagCounts();
  }

  async insights() {
    const now = new Date();
    const months = lastMonths(12, now);
    const firstMonth = new Date(`${months[0]}-01T00:00:00Z`);
    const startOfToday = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
    const [rows, signups, renewing] = await Promise.all([
      this.scored({}, now),
      tenantListRepository.signupsByMonth(firstMonth),
      tenantListRepository.renewingSubscriptions(
        startOfToday,
        new Date(startOfToday.getTime() + 8 * 7 * DAY_MS),
      ),
    ]);
    return {
      growth: buildGrowth(months, new Map(signups.rows.map((r) => [r.m, r.n])), signups.before),
      planMix: buildPlanMix(rows),
      healthDistribution: healthDistribution(rows.map((r) => r.healthScore)),
      // The schema stores no signup source / referral / utm on Tenant or onboarding -> deliberately null.
      signupsBySource: null as Array<{ source: string; count: number }> | null,
      renewals: buildRenewals(renewing, 8, now),
    };
  }
}

export const tenantListService = new TenantListService();
