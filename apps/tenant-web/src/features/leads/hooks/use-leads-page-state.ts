'use client';

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { useDebouncedValue } from '@/hooks/use-debounced-value';
import type { AnalyticsParams, AnalyticsRangeKey, FollowUpState, LeadSortBy, LeadSource, LeadStatus, ListLeadsParams } from '../types';
import { LEAD_SOURCES, LEAD_STATUSES } from '../types';

export type LeadsView = 'board' | 'table';
export const BOARD_LIMIT = 100;
export const TABLE_LIMIT = 15;

const RANGES: AnalyticsRangeKey[] = ['today', '7d', '30d', 'month', 'year', 'custom'];
const FOLLOW_UPS: FollowUpState[] = ['overdue', 'today', 'upcoming', 'none'];
const SORTS: LeadSortBy[] = ['createdAt', 'updatedAt', 'name', 'nextFollowUpAt', 'lastActivityAt', 'expectedJoinDate'];

/**
 * Single source of truth for the /leads page controls, stored in the URL query string
 * (shareable, survives reload, back/forward friendly). Only non-default values are written.
 */
export function useLeadsPageState() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const get = (k: string) => sp.get(k) ?? '';
  const view: LeadsView = get('view') === 'table' ? 'table' : 'board';
  const range: AnalyticsRangeKey = RANGES.includes(get('range') as AnalyticsRangeKey) ? (get('range') as AnalyticsRangeKey) : '30d';
  const compare = get('cmp') !== '0';
  const rangeFrom = get('rfrom');
  const rangeTo = get('rto');
  const status: LeadStatus | '' = LEAD_STATUSES.includes(get('status') as LeadStatus) ? (get('status') as LeadStatus) : '';
  const source: LeadSource | '' = LEAD_SOURCES.includes(get('source') as LeadSource) ? (get('source') as LeadSource) : '';
  const followUp: FollowUpState | '' = FOLLOW_UPS.includes(get('fu') as FollowUpState) ? (get('fu') as FollowUpState) : '';
  const sortBy: LeadSortBy = SORTS.includes(get('sort') as LeadSortBy) ? (get('sort') as LeadSortBy) : 'createdAt';
  const sortDir: 'asc' | 'desc' = get('dir') === 'asc' ? 'asc' : 'desc';
  const page = Math.max(1, Number(get('page')) || 1);

  const [search, setSearch] = React.useState(get('q'));
  const debouncedSearch = useDebouncedValue(search, 350);

  const set = React.useCallback(
    (patch: Record<string, string | null>, resetPage = true) => {
      const next = new URLSearchParams(sp.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v === null || v === '') next.delete(k);
        else next.set(k, v);
      }
      if (resetPage && !('page' in patch)) next.delete('page');
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname, sp],
  );

  // Push the debounced search into the URL.
  React.useEffect(() => {
    if (debouncedSearch !== (sp.get('q') ?? '')) set({ q: debouncedSearch });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to the debounced text
  }, [debouncedSearch]);

  const branchId = get('branch');
  const analyticsParams: AnalyticsParams | null =
    range === 'custom' && !(rangeFrom && rangeTo) ? null : { range, dateFrom: range === 'custom' ? rangeFrom : undefined, dateTo: range === 'custom' ? rangeTo : undefined, branchId: branchId || undefined };

  const listFilters: ListLeadsParams = {
    search: debouncedSearch || undefined,
    source: source ? [source] : undefined,
    assignedTo: get('assignee') || undefined,
    branchId: branchId || undefined,
    interestedPlanId: get('plan') || undefined,
    createdFrom: get('from') || undefined,
    createdTo: get('to') || undefined,
    followUp: followUp || undefined,
  };
  const listParams: ListLeadsParams =
    view === 'board'
      ? { ...listFilters, limit: BOARD_LIMIT, sortBy: 'lastActivityAt', sortDir: 'desc' }
      : { ...listFilters, status: status ? [status] : undefined, page, limit: TABLE_LIMIT, sortBy, sortDir };

  const activeFilterCount = [debouncedSearch, status, source, get('assignee'), get('plan'), get('from'), get('to'), followUp].filter(Boolean).length;

  const clearFilters = () => {
    setSearch('');
    set({ q: null, status: null, source: null, assignee: null, plan: null, from: null, to: null, fu: null });
  };

  return {
    view, range, compare, rangeFrom, rangeTo, status, source, followUp, sortBy, sortDir, page, branchId,
    assignee: get('assignee'), plan: get('plan'), createdFrom: get('from'), createdTo: get('to'),
    search, setSearch, set, analyticsParams, listParams, listFilters, activeFilterCount, clearFilters,
  };
}

export type LeadsPageState = ReturnType<typeof useLeadsPageState>;
