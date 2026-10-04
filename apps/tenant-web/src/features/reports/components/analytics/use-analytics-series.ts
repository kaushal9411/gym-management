'use client';

import * as React from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { reportsService } from '../../services/reports.service';
import { shortDate } from '../../lib/format';
import type { RevenueTrendPoint, TrendPoint } from '../../types';
import type { SeriesSlug } from './analytics-config';

type Raw = TrendPoint[] | RevenueTrendPoint[];

const FETCH: Record<SeriesSlug, (from?: string, to?: string, branch?: string) => Promise<Raw>> = {
  'revenue-trends': (f, t, b) => reportsService.revenueTrends(f, t, b),
  'attendance-trends': (f, t, b) => reportsService.attendanceTrends(f, t, b),
  'membership-growth': (f, t, b) => reportsService.membershipGrowth(f, t, b),
  'new-member-growth': (f, t, b) => reportsService.newMemberGrowth(f, t, b),
  retention: (f, t, b) => reportsService.retention(f, t, b),
  'payment-collection': (f, t, b) => reportsService.paymentCollection(f, t, b),
};

export interface NormPoint {
  date: string;
  a: number;
  b?: number;
}

/** One chart row: current (`a`/`b`) and the aligned previous-period values (`pa`/`pb`). */
export interface MergedRow {
  label: string;
  tip: string;
  a: number;
  b?: number;
  pa?: number;
  pb?: number;
}

const normalize = (raw: Raw | undefined): NormPoint[] | undefined =>
  raw?.map((p) => ('income' in p ? { date: p.date, a: Number(p.income) || 0, b: Number(p.expenses) || 0 } : { date: p.date, a: Number(p.value) || 0 }));

/**
 * Same query keys as the existing `useRevenueTrends`/… hooks (so the cache is shared) but with `enabled`,
 * which those hooks lack - lets the page skip views and the previous range when they are not needed.
 */
export function useSeriesQuery(slug: SeriesSlug, from: string, to: string, branchId: string | undefined, enabled: boolean) {
  const q = useQuery({
    queryKey: ['reports', 'analytics', slug, from, to, branchId],
    queryFn: () => FETCH[slug](from, to, branchId),
    enabled,
    placeholderData: keepPreviousData,
  });
  const points = React.useMemo(() => normalize(q.data), [q.data]);
  return { points, isPending: q.isPending && q.fetchStatus !== 'idle', isError: q.isError };
}

const DAY = 86_400_000;
const ymd = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** Previous range of equal length ending the day before `from` (the controls hook does not expose it). */
export function previousRange(from: string, to: string): { from: string; to: string } {
  const f = Date.parse(`${from}T00:00:00Z`);
  const t = Date.parse(`${to}T00:00:00Z`);
  const days = Math.round((t - f) / DAY) + 1;
  return { from: ymd(f - days * DAY), to: ymd(f - DAY) };
}

export function mergeSeries(current: NormPoint[] | undefined, previous: NormPoint[] | undefined): MergedRow[] {
  return (current ?? []).map((p, i) => ({
    label: shortDate(p.date),
    tip: p.date,
    a: p.a,
    b: p.b,
    pa: previous?.[i]?.a,
    pb: previous?.[i]?.b,
  }));
}
