import type { MergedRow } from './use-analytics-series';

export interface SeriesStats {
  total: number;
  prevTotal?: number;
  average: number;
  prevAverage?: number;
  latest: number;
  prevLatest?: number;
  peak: number;
  peakDate: string;
  /** % change of total (flow) or latest (snapshot) vs previous; null when no previous or previous is 0. */
  change: number | null;
  totalB?: number;
  prevTotalB?: number;
}

/** Summary numbers for the stats row, computed from the merged rows (series `a`, optional second series `b`). */
export function computeStats(rows: MergedRow[], kind: 'flow' | 'snapshot'): SeriesStats {
  const n = rows.length || 1;
  const hasPrev = rows.some((r) => r.pa !== undefined);
  const total = rows.reduce((s, r) => s + r.a, 0);
  const prevTotal = hasPrev ? rows.reduce((s, r) => s + (r.pa ?? 0), 0) : undefined;
  const latest = rows.length ? rows[rows.length - 1]!.a : 0;
  const prevLatest = hasPrev ? rows.filter((r) => r.pa !== undefined).at(-1)?.pa : undefined;
  let peak = 0;
  let peakDate = '';
  for (const r of rows) {
    if (r.a > peak || peakDate === '') {
      peak = r.a;
      peakDate = r.tip;
    }
  }
  const basis = kind === 'flow' ? total : latest;
  const prevBasis = kind === 'flow' ? prevTotal : prevLatest;
  const hasB = rows.some((r) => r.b !== undefined);
  return {
    total,
    prevTotal,
    average: total / n,
    prevAverage: prevTotal !== undefined ? prevTotal / n : undefined,
    latest,
    prevLatest,
    peak,
    peakDate,
    change: prevBasis !== undefined && prevBasis !== 0 ? ((basis - prevBasis) / prevBasis) * 100 : null,
    totalB: hasB ? rows.reduce((s, r) => s + (r.b ?? 0), 0) : undefined,
    prevTotalB: hasB && hasPrev ? rows.reduce((s, r) => s + (r.pb ?? 0), 0) : undefined,
  };
}
