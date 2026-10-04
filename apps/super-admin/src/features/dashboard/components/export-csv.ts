import type { DashboardOverview, OverviewRange } from '../types';

const esc = (v: unknown): string => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Builds a CSV of exactly what the dashboard shows (KPIs + daily series). Client-side only. */
export function buildOverviewCsv(o: DashboardOverview, range: OverviewRange): string {
  const rows: unknown[][] = [['FitCloud platform overview'], ['Range', range, o.range.from, o.range.to], ['Generated', o.generatedAt], [], ['KPI', 'Value', 'Previous period']];
  const k = o.kpis;
  const add = (label: string, v: { value: number | string; previous?: number | string | null } | null | undefined) => { if (v) rows.push([label, v.value, v.previous ?? '']); };
  add('Tenants total', k.tenantsTotal); add('New tenants', k.newTenants); add('Active tenants', k.activeTenants); add('In trial', k.trialTenants);
  add('Suspended', k.suspendedTenants); add('Expired', k.expiredTenants); add('MRR', k.mrr); add('ARR', k.arr); add('ARPA', k.arpa);
  add('Revenue collected', k.revenueCollected); add('Failed payments', k.failedPayments); add('Churned', k.churned); add('Trial conversion %', k.trialConversion);

  const dates = new Set<string>([...o.signupsDaily.map((d) => d.date), ...o.revenueDaily.map((d) => d.date), ...(o.churnedDaily ?? []).map((d) => d.date), ...(o.mrrDaily ?? []).map((d) => d.date)]);
  const sg = new Map(o.signupsDaily.map((d) => [d.date, d]));
  const rv = new Map(o.revenueDaily.map((d) => [d.date, d]));
  const ch = new Map((o.churnedDaily ?? []).map((d) => [d.date, d]));
  const mr = new Map((o.mrrDaily ?? []).map((d) => [d.date, d]));
  rows.push([], ['Date', 'New tenants', 'New tenants (prev)', 'Churned', 'Churned (prev)', 'Revenue collected', 'Revenue collected (prev)', 'MRR']);
  for (const d of [...dates].sort()) {
    rows.push([d, sg.get(d)?.count, sg.get(d)?.previousCount, ch.get(d)?.count, ch.get(d)?.previousCount, rv.get(d)?.amount, rv.get(d)?.previousAmount, mr.get(d)?.mrr]);
  }
  rows.push([], ['Plan', 'Active subscriptions', 'MRR']);
  for (const p of o.planMix) rows.push([p.planName, p.activeSubscriptions, p.mrr]);
  return rows.map((r) => r.map(esc).join(',')).join('\n');
}

export function downloadCsv(filename: string, csv: string): void {
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
