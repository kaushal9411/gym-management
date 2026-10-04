'use client';

import { useId, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { Download, Printer, RefreshCw } from 'lucide-react';
import { Bar as RBar, BarChart, CartesianGrid, ComposedChart, Legend as RLegend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { Button } from '@/components/ui/button';
import { fmtCompact, fmtInt, fmtMoney, fmtMoneyCompact } from '@/features/dashboard/components/format';
import { KpiCard } from '@/features/dashboard/components/kpi-card';
import { Bar, ChartTooltip, CountUp, EmptyNote, Panel, Segmented } from '@/features/dashboard/components/ui';
import { useTenantReports, type ReportRange, type TenantReports } from '@/features/tenants/api/detail';
import { cn } from '@/lib/utils';

const AXIS = { fontSize: 11, fill: 'var(--muted-foreground)' } as const;
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const ROLE_COLOR: Record<string, string> = { OWNER: 'var(--chart-3)', MANAGER: 'var(--chart-4)', TRAINER: 'var(--chart-2)', RECEPTIONIST: 'var(--chart-1)' };
const ROLE_LABEL: Record<string, string> = { OWNER: 'Owner', MANAGER: 'Managers', TRAINER: 'Trainers', RECEPTIONIST: 'Reception' };
const FEATURE_COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-6)', 'var(--chart-8)'];
const RANGES: Array<{ value: ReportRange; label: string }> = [{ value: '30d', label: '30D' }, { value: '90d', label: '90D' }, { value: '6m', label: '6M' }, { value: '12m', label: '12M' }];
const RANGE_LABEL: Record<ReportRange, string> = { '30d': 'last 30 days', '90d': 'last 90 days', '6m': 'last 6 months', '12m': 'last 12 months' };

const mLabel = (m: string) => new Date(`${m}-01T00:00:00Z`).toLocaleDateString('en-IN', { month: 'short', year: m.length === 7 ? '2-digit' : undefined, timeZone: 'UTC' });
const wLabel = (w: string) => new Date(`${w}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const featureName = (f: string) => f.replace(/[_-]/g, ' ').replace(/^./, (c) => c.toUpperCase());
const num = (v: string | number | null | undefined) => (v === null || v === undefined ? null : Number(v));
const signed = (v: number) => `${v > 0 ? '+' : ''}${fmtInt(v)}`;
const hourLabel = (h: number) => (h === 0 ? '12a' : h < 12 ? `${h}a` : h === 12 ? '12p' : `${h - 12}p`);

/** Card shell with the loading / empty / content states every chart shares. */
function ChartCard({ title, hint, empty, loading, index, className, children }: { title: string; hint?: React.ReactNode; empty: boolean; loading: boolean; index: number; className?: string; children: React.ReactNode }) {
  return (
    <Panel title={title} hint={hint} index={index} className={cn('break-inside-avoid', className)}>
      {loading ? <div className="h-40 animate-pulse rounded-lg bg-muted" aria-busy="true" aria-label={`Loading ${title}`} /> : empty ? <EmptyNote>Not enough data yet</EmptyNote> : children}
    </Panel>
  );
}

function StaticKpi({ label, value, sub, color, tone }: { label: string; value: React.ReactNode; sub: string; color: string; tone?: string }) {
  return (
    <div className="min-w-0 rounded-[14px] border border-t-[3px] bg-card px-4 py-3.5" style={{ borderTopColor: color }}>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className={cn('mt-1 truncate text-[26px] font-semibold leading-[1.15] tracking-tight tabular-nums', tone)}>{value}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>
    </div>
  );
}

function Heatmap({ cells }: { cells: TenantReports['checkInHeatmap'] }) {
  const grid = Array.from({ length: 7 }, () => Array<number>(24).fill(0));
  for (const c of cells) if (c.weekday >= 0 && c.weekday < 7 && c.hour >= 0 && c.hour < 24) grid[c.weekday]![c.hour] = c.count;
  const max = Math.max(1, ...grid.flat());
  const dayTotals = grid.map((r) => r.reduce((a, b) => a + b, 0));
  const hourTotals = Array.from({ length: 24 }, (_, h) => grid.reduce((a, r) => a + r[h]!, 0));
  const peakDay = WEEKDAYS[dayTotals.indexOf(Math.max(...dayTotals))];
  const peakHour = hourTotals.indexOf(Math.max(...hourTotals));
  const level = (n: number) => (n === 0 ? 0 : Math.max(1, Math.ceil((n / max) * 4)));
  const bg = ['var(--muted)', 'color-mix(in srgb, var(--chart-1) 22%, transparent)', 'color-mix(in srgb, var(--chart-1) 45%, transparent)', 'color-mix(in srgb, var(--chart-1) 72%, transparent)', 'var(--chart-1)'];
  return (
    <div>
      <div className="grid gap-[2px]" style={{ gridTemplateColumns: '28px repeat(24, minmax(0, 1fr))' }} role="img" aria-label={`Check-ins by weekday and hour (UTC). Peak ${peakDay} around ${hourLabel(peakHour)}.`}>
        <span />
        {Array.from({ length: 24 }, (_, h) => <span key={h} className="text-center text-[9px] leading-4 text-muted-foreground">{h % 3 === 0 ? hourLabel(h) : ''}</span>)}
        {grid.map((row, d) => (
          <div key={d} className="contents">
            <span className="pr-1 text-right text-[10px] leading-5 text-muted-foreground">{WEEKDAYS[d]}</span>
            {row.map((n, h) => <span key={h} title={`${WEEKDAYS[d]} ${String(h).padStart(2, '0')}:00 UTC — ${n} check-in${n === 1 ? '' : 's'}`} className="h-5 rounded-[3px]" style={{ background: bg[level(n)] }} />)}
          </div>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span>Quiet</span><span className="inline-flex gap-[2px]">{bg.map((b, i) => <i key={i} className="h-2.5 w-3.5 rounded-sm" style={{ background: b }} />)}</span>
        <span>Busy · peak {peakDay} ~{hourLabel(peakHour)}</span><span className="ml-auto">All times UTC</span>
      </div>
    </div>
  );
}

function Cohorts({ rows }: { rows: TenantReports['retentionCohorts'] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[320px] border-separate border-spacing-[2px] text-center text-xs">
        <thead><tr className="text-muted-foreground"><th className="text-left font-medium">Joined</th>{[0, 1, 2, 3, 4, 5].map((i) => <th key={i} className="font-medium">M{i}</th>)}</tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.cohort}>
              <td className="text-left text-muted-foreground">{mLabel(r.cohort)}</td>
              {Array.from({ length: 6 }, (_, i) => {
                const v = r.values[i] ?? null;
                return <td key={i} className="rounded py-1.5 font-mono font-semibold" style={v === null ? { background: 'var(--muted)', color: 'var(--muted-foreground)' } : { background: `color-mix(in srgb, var(--chart-6) ${Math.round(15 + (v / 100) * 70)}%, var(--card))`, color: 'var(--foreground)' }}>{v === null ? '—' : `${Math.round(v)}%`}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function csvEscape(v: string | number | null): string {
  const s = v === null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function buildCsv(r: TenantReports, name: string): string {
  const rows: Array<Array<string | number | null>> = [['section', 'label', 'metric', 'value'], ['meta', name, `range ${r.range}`, `${r.currentRange.from} → ${r.currentRange.to} (UTC)`]];
  r.memberGrowth.forEach((m) => { rows.push(['member_growth', m.month, 'new', m.new], ['member_growth', m.month, 'lost', m.lost], ['member_growth', m.month, 'total', m.total]); });
  r.featureAdoption.forEach((f) => rows.push(['feature_adoption', f.feature, 'share_pct', f.share]));
  r.checkInHeatmap.forEach((c) => rows.push(['checkin_heatmap_utc', `${WEEKDAYS[c.weekday]} ${String(c.hour).padStart(2, '0')}:00`, 'count', c.count]));
  r.revenueByMonth.forEach((m) => rows.push(['revenue_paid_to_fitcloud', m.month, 'amount', m.amount]));
  r.paymentMethods.forEach((p) => rows.push(['payment_methods', p.method, 'share_pct', p.share]));
  r.retentionCohorts.forEach((c) => c.values.forEach((v, i) => rows.push(['retention_cohort', c.cohort, `M${i}`, v])));
  r.staffLoginsByRole.forEach((s) => rows.push(['staff_logins', s.week, s.role, s.count]));
  r.ticketsByMonth.forEach((t) => rows.push(['tickets', t.month, 'open', t.open], ['tickets', t.month, 'in_progress', t.inProgress], ['tickets', t.month, 'resolved', t.resolved], ['tickets', t.month, 'closed', t.closed]));
  r.planUtilization.forEach((p) => rows.push(['plan_utilization', p.month, 'members', p.members], ['plan_utilization', p.month, 'limit', p.limit]));
  return rows.map((row) => row.map(csvEscape).join(',')).join('\n');
}
function downloadCsv(text: string, file: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url; a.download = file; document.body.appendChild(a); a.click(); a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Print stylesheet: only the report remains (shell, banner, tab bar and controls are hidden; cards avoid page breaks). */
const PRINT_CSS = `@media print{
  aside,header.sticky,[data-sonner-toaster],[data-no-print],.fixed{display:none!important}
  html,body{background:#fff!important}
  main{padding:0!important}
  .print-only{display:block!important}
  *{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  [data-print-grid]{display:block!important}
  [data-print-grid]>*{margin-bottom:12px}
}`;

export function ReportsTab({ tenantId, tenantName }: { tenantId: string; tenantSlug?: string; tenantName: string; canManage?: boolean }) {
  const reduce = !!useReducedMotion();
  const [range, setRange] = useState<ReportRange>('6m');
  const [compare, setCompare] = useState(true);
  const cmpId = useId();
  const q = useTenantReports(tenantId, range, compare);
  const r = q.data;
  const loading = q.isLoading;

  if (q.isError && !r) {
    return (
      <div className="space-y-3 rounded-[14px] border bg-card p-6 text-center">
        <p className="text-sm text-destructive">Could not load reports.</p>
        <Button size="sm" variant="outline" onClick={() => void q.refetch()}><RefreshCw className="size-4" aria-hidden />Retry</Button>
      </div>
    );
  }

  const k = r?.kpis;
  const tickets = (r?.ticketsByMonth ?? []).map((t) => ({ ...t, label: mLabel(t.month) }));
  const weeks = Array.from(new Set((r?.staffLoginsByRole ?? []).map((s) => s.week))).sort();
  const roles = Array.from(new Set((r?.staffLoginsByRole ?? []).map((s) => s.role)));
  const staff = weeks.map((w) => ({ label: wLabel(w), ...Object.fromEntries(roles.map((role) => [role, r!.staffLoginsByRole.find((s) => s.week === w && s.role === role)?.count ?? 0])) }));
  const hasHeat = (r?.checkInHeatmap ?? []).some((c) => c.count > 0);
  const util = (r?.planUtilization ?? []).map((p) => ({ ...p, label: mLabel(p.month) }));
  const limit = util.find((p) => p.limit !== null)?.limit ?? null;
  const months80 = r?.projection.monthsTo80Pct ?? null;
  const rev = (r?.revenueByMonth ?? []).map((m) => ({ label: mLabel(m.month), amount: Number(m.amount) }));

  return (
    <div className="space-y-4">
      <style>{PRINT_CSS}</style>
      <div className="print-only hidden">
        <h1 className="text-xl font-semibold">{tenantName} — tenant report</h1>
        <p className="text-sm">{RANGE_LABEL[range]}{r ? ` · ${r.currentRange.from.slice(0, 10)} → ${r.currentRange.to.slice(0, 10)} (UTC)` : ''}</p>
      </div>

      <div data-no-print className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Segmented label="Report range" value={range} onChange={setRange} options={RANGES} />
          {q.isFetching && !loading ? <span className="text-xs text-muted-foreground" role="status">Updating…</span> : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor={cmpId} className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border bg-card px-3 text-[13px] font-semibold">
            <input id={cmpId} type="checkbox" checked={compare} onChange={(e) => setCompare(e.target.checked)} className="size-4 accent-[var(--primary)]" />Compare with previous
          </label>
          <Button type="button" variant="outline" size="sm" className="h-9" disabled={!r} onClick={() => r && downloadCsv(buildCsv(r, tenantName), `${tenantName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-report-${range}.csv`)}><Download className="size-4" aria-hidden />Export CSV</Button>
          <Button type="button" size="sm" className="h-9" disabled={!r} onClick={() => window.print()} title="Opens the browser print dialog — choose “Save as PDF”"><Printer className="size-4" aria-hidden />Print / save as PDF</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {!k ? Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-[96px] animate-pulse rounded-[14px] bg-muted" />) : (
          <>
            <KpiCard index={0} color="var(--chart-1)" label="Revenue paid to FitCloud" value={Number(k.revenuePaid.value)} previous={num(k.revenuePaid.previous)} format={fmtMoneyCompact} fallbackCaption={RANGE_LABEL[range]} />
            <KpiCard index={1} color="var(--chart-2)" label="Member growth (net)" value={Number(k.memberGrowth.value)} previous={num(k.memberGrowth.previous)} format={signed} deltaMode="abs" fallbackCaption="new − lost" />
            <KpiCard index={2} color="var(--chart-6)" label="Check-ins / day" value={Number(k.checkInsPerDay.value)} previous={num(k.checkInsPerDay.previous)} format={(v) => String(Math.round(v * 10) / 10)} fallbackCaption="daily average" />
            {k.retention90d ? <KpiCard index={3} color="var(--chart-3)" label="90-day retention" value={Number(k.retention90d.value)} previous={num(k.retention90d.previous)} format={(v) => `${Math.round(v)}%`} deltaMode="abs" absSuffix=" pts" fallbackCaption="of members joined 90d ago" /> : <StaticKpi label="90-day retention" value="—" sub="no members joined 90d ago" color="var(--chart-3)" />}
            <StaticKpi label="Support tickets" color="var(--chart-5)" value={<CountUp value={Number(k.supportTickets.value)} format={fmtInt} />} sub={k.supportTickets.avgResolutionHours != null ? `avg ${Math.round(k.supportTickets.avgResolutionHours * 10) / 10}h to resolve` : 'no resolved tickets yet'} />
            <StaticKpi label="Churn risk" color="var(--chart-4)" value={k.churnRisk.label} sub={`health score ${k.churnRisk.score}`} tone={k.churnRisk.label === 'Low' ? 'text-green-700 dark:text-green-400' : k.churnRisk.label === 'Medium' ? 'text-amber-700 dark:text-amber-400' : 'text-red-700 dark:text-red-400'} />
          </>
        )}
      </div>

      <div data-print-grid className="grid gap-4 lg:grid-cols-12">
        <ChartCard className="lg:col-span-8" title="Member growth" hint="new vs lost, with total" index={0} loading={loading} empty={!r || r.memberGrowth.every((m) => m.new === 0 && m.lost === 0 && m.total === 0)}>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={(r?.memberGrowth ?? []).map((m) => ({ ...m, label: mLabel(m.month) }))} margin={{ left: -8, right: -8, top: 8 }}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} />
                <YAxis yAxisId="a" tick={AXIS} tickLine={false} axisLine={false} allowDecimals={false} width={40} />
                <YAxis yAxisId="b" orientation="right" tick={AXIS} tickLine={false} axisLine={false} allowDecimals={false} width={40} />
                <Tooltip content={<ChartTooltip fmt={fmtInt} names={{ new: 'New', lost: 'Lost', total: 'Total members' }} />} />
                <RBar yAxisId="a" dataKey="new" fill="var(--chart-1)" radius={[3, 3, 0, 0]} maxBarSize={26} isAnimationActive={!reduce} />
                <RBar yAxisId="a" dataKey="lost" fill="var(--chart-5)" radius={[3, 3, 0, 0]} maxBarSize={20} isAnimationActive={!reduce} />
                <Line yAxisId="b" dataKey="total" stroke="var(--foreground)" strokeWidth={2.2} dot={{ r: 3 }} isAnimationActive={!reduce} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground"><span><i className="mr-1 inline-block size-2 rounded-sm" style={{ background: 'var(--chart-1)' }} />New members</span><span><i className="mr-1 inline-block size-2 rounded-sm" style={{ background: 'var(--chart-5)' }} />Lost (removed)</span><span>━ Total (right axis)</span></div>
        </ChartCard>

        <ChartCard className="lg:col-span-4" title="Feature adoption" hint="share of active members" index={1} loading={loading} empty={!r || r.featureAdoption.length === 0}>
          <div className="space-y-3">
            {(r?.featureAdoption ?? []).map((f, i) => (
              <div key={f.feature}><div className="mb-1 flex justify-between text-[12.5px]"><span>{featureName(f.feature)}</span><b className="font-mono">{Math.round(f.share)}%</b></div><Bar pct={f.share} color={FEATURE_COLORS[i % FEATURE_COLORS.length]!} height={8} /></div>
            ))}
          </div>
        </ChartCard>

        <ChartCard className="lg:col-span-7" title="Check-in pattern" hint={`weekday × hour, ${RANGE_LABEL[range]}`} index={2} loading={loading} empty={!hasHeat}>
          <Heatmap cells={r?.checkInHeatmap ?? []} />
        </ChartCard>

        <ChartCard className="lg:col-span-5" title="Revenue paid to FitCloud" hint="platform payments per month, not member payments" index={3} loading={loading} empty={!r || rev.every((m) => m.amount === 0)}>
          <div className="h-[130px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rev} margin={{ left: -8, top: 6 }}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} />
                <YAxis tick={AXIS} tickLine={false} axisLine={false} width={48} tickFormatter={(v: number) => fmtCompact(v)} />
                <Tooltip content={<ChartTooltip fmt={fmtMoney} names={{ amount: 'Paid' }} />} />
                <RBar dataKey="amount" fill="var(--chart-2)" radius={[4, 4, 0, 0]} maxBarSize={36} isAnimationActive={!reduce} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          {r && r.paymentMethods.length ? (
            <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[12.5px]">
              {r.paymentMethods.map((p, i) => <div key={p.method} className="flex items-center gap-1.5"><i className="size-2 shrink-0 rounded-sm" style={{ background: FEATURE_COLORS[i % FEATURE_COLORS.length] }} /><span className="truncate">{p.method.length <= 4 ? p.method.toUpperCase() : featureName(p.method.toLowerCase())}</span><b className="ml-auto font-mono">{Math.round(p.share)}%</b></div>)}
            </div>
          ) : null}
        </ChartCard>

        <ChartCard className="lg:col-span-6" title="Member retention cohorts" hint="% still active" index={4} loading={loading} empty={!r || r.retentionCohorts.length === 0}>
          <Cohorts rows={r?.retentionCohorts ?? []} />
        </ChartCard>

        <ChartCard className="lg:col-span-6" title="Staff activity" hint="logins per week by role" index={5} loading={loading} empty={!r || staff.every((s) => roles.every((role) => (s as Record<string, unknown>)[role] === 0))}>
          <div className="h-[170px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={staff} margin={{ left: -8, top: 6 }}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} />
                <YAxis tick={AXIS} tickLine={false} axisLine={false} allowDecimals={false} width={40} />
                <Tooltip content={<ChartTooltip fmt={fmtInt} names={ROLE_LABEL} />} />
                <RLegend formatter={(v: string) => <span className="text-xs text-muted-foreground">{ROLE_LABEL[v] ?? v}</span>} iconType="square" iconSize={8} />
                {roles.map((role) => <RBar key={role} dataKey={role} stackId="s" fill={ROLE_COLOR[role] ?? 'var(--chart-7)'} maxBarSize={44} isAnimationActive={!reduce} />)}
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-muted-foreground">Weeks start Monday (UTC).</p>
        </ChartCard>

        <ChartCard className="lg:col-span-6" title="Support & incidents" hint="tickets by month" index={6} loading={loading} empty={!r || tickets.every((t) => t.open + t.inProgress + t.resolved + t.closed === 0)}>
          <div className="h-[140px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={tickets} margin={{ left: -8, top: 6 }}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} />
                <YAxis tick={AXIS} tickLine={false} axisLine={false} allowDecimals={false} width={32} />
                <Tooltip content={<ChartTooltip fmt={fmtInt} names={{ open: 'Open', inProgress: 'In progress', resolved: 'Resolved', closed: 'Closed' }} />} />
                <RBar dataKey="open" stackId="t" fill="var(--chart-5)" isAnimationActive={!reduce} />
                <RBar dataKey="inProgress" stackId="t" fill="var(--chart-4)" isAnimationActive={!reduce} />
                <RBar dataKey="resolved" stackId="t" fill="var(--chart-6)" isAnimationActive={!reduce} />
                <RBar dataKey="closed" stackId="t" fill="var(--chart-7)" radius={[3, 3, 0, 0]} isAnimationActive={!reduce} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-1 text-[12.5px] sm:grid-cols-4">
            {[['Open', 'var(--chart-5)'], ['In progress', 'var(--chart-4)'], ['Resolved', 'var(--chart-6)'], ['Closed', 'var(--chart-7)']].map(([n, c]) => <span key={n} className="flex items-center gap-1.5"><i className="size-2 rounded-sm" style={{ background: c }} />{n}</span>)}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Avg first reply: <b className="font-mono text-foreground">{r?.avgFirstReplyHours != null ? `${Math.round(r.avgFirstReplyHours * 10) / 10}h` : '—'}</b></p>
        </ChartCard>

        <ChartCard className="lg:col-span-6" title="Plan utilisation trend" hint={limit !== null ? `members vs limit ${fmtInt(limit)}` : 'members (no member limit)'} index={7} loading={loading} empty={!r || util.length === 0 || util.every((u) => u.members === 0)}>
          <div className="h-[150px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={util} margin={{ left: -8, right: 8, top: 8 }}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} />
                <YAxis tick={AXIS} tickLine={false} axisLine={false} allowDecimals={false} width={40} domain={[0, (max: number) => Math.max(max, limit ?? 0)]} />
                <Tooltip content={<ChartTooltip fmt={fmtInt} names={{ members: 'Members' }} />} />
                {limit !== null ? <ReferenceLine y={limit} stroke="var(--chart-5)" strokeDasharray="5 4" label={{ value: `limit ${fmtInt(limit)}`, position: 'insideTopRight', fontSize: 10, fill: 'var(--muted-foreground)' }} /> : null}
                <Line dataKey="members" stroke="var(--chart-3)" strokeWidth={2.5} dot={{ r: 3 }} isAnimationActive={!reduce} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {months80 === null ? 'No projection: member count is flat or the plan has no member limit.' : months80 === 0 ? 'Already at or past 80% of the member limit.' : `At the current growth rate this tenant reaches 80% of its member limit in ~${months80} month${months80 === 1 ? '' : 's'}.`}
            {' '}The limit line shows today&apos;s effective limit (history isn&apos;t stored).
          </p>
        </ChartCard>
      </div>
      {r ? <p className="text-xs text-muted-foreground print:text-black">Data windows are UTC · {RANGE_LABEL[range]}{r.previousRange ? ' · compared with the preceding period of equal length' : ''}.</p> : null}
    </div>
  );
}
