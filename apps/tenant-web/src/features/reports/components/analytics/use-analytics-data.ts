'use client';

import * as React from 'react';

import type { SeriesSlug, ViewSlug } from './analytics-config';
import { mergeSeries, previousRange, useSeriesQuery, type MergedRow } from './use-analytics-series';

export interface SeriesResult {
  rows: MergedRow[];
  isPending: boolean;
  isError: boolean;
}

interface Ctx {
  from: string;
  to: string;
  branchId: string | undefined;
  ready: boolean;
  compare: boolean;
  /** Active focus view, or null for the overview (all views enabled). */
  view: ViewSlug | null;
}

function useOne(slug: SeriesSlug, c: Ctx): SeriesResult {
  const active = c.ready && (c.view === null || c.view === slug);
  const prev = React.useMemo(() => previousRange(c.from || '1970-01-01', c.to || '1970-01-01'), [c.from, c.to]);
  const cur = useSeriesQuery(slug, c.from, c.to, c.branchId, active);
  const old = useSeriesQuery(slug, prev.from, prev.to, c.branchId, active && c.compare);
  const rows = React.useMemo(() => mergeSeries(cur.points, c.compare ? old.points : undefined), [cur.points, old.points, c.compare]);
  return { rows, isPending: cur.isPending, isError: cur.isError };
}

/** All six series views (current + previous range); queries only run for the active view (or all in the overview). */
export function useAnalyticsData(c: Ctx): Record<SeriesSlug, SeriesResult> {
  return {
    'revenue-trends': useOne('revenue-trends', c),
    'attendance-trends': useOne('attendance-trends', c),
    'membership-growth': useOne('membership-growth', c),
    'new-member-growth': useOne('new-member-growth', c),
    retention: useOne('retention', c),
    'payment-collection': useOne('payment-collection', c),
  };
}
