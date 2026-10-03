'use client';

import * as React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Clock3, DoorOpen, LogIn, LogOut, PieChart as PieChartIcon, TrendingDown, TrendingUp, UserCheck, type LucideIcon } from 'lucide-react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { Skeleton } from '@/components/ui/skeleton';
import { type Accent, CountUp, IconChip, PanelCard, accentVar, tint } from '@/features/members/components/detail/detail-ui';
import { AttendanceMethodBadge, AttendanceStatusBadge } from './attendance-badges';
import type { AttendanceMethod, AttendanceRecord, AttendanceSummary } from '../types';

const AXIS = { fill: 'var(--muted-foreground)', fontSize: 11 };
const TOOLTIP_STYLE = {
  contentStyle: { background: 'var(--popover)', color: 'var(--popover-foreground)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: 'var(--shadow-md)', fontSize: 12 },
  labelStyle: { color: 'var(--foreground)', fontWeight: 500, marginBottom: 2 },
};

function formatHour(hour: number | null): string {
  if (hour === null) return '—';
  const period = hour < 12 ? 'AM' : 'PM';
  const twelveHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${twelveHour}:00 ${period}`;
}

function weekdayLabel(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short' });
}

/** Derived purely from the 30-day `trend` array — today/yesterday and this-week/last-week all come from the same single `getSummary` call, no extra endpoints. */
export function computeTrendMetrics(trend: AttendanceSummary['trend'] | undefined) {
  const points = trend ?? [];
  const today = points.at(-1)?.count ?? 0;
  const yesterday = points.at(-2)?.count ?? 0;
  const todayDeltaPct = yesterday > 0 ? ((today - yesterday) / yesterday) * 100 : today > 0 ? 100 : 0;

  const thisWeek = points.slice(-7);
  const lastWeek = points.slice(-14, -7);
  const thisWeekSum = thisWeek.reduce((s, p) => s + p.count, 0);
  const lastWeekSum = lastWeek.reduce((s, p) => s + p.count, 0);
  const weekDeltaPct = lastWeekSum > 0 ? ((thisWeekSum - lastWeekSum) / lastWeekSum) * 100 : thisWeekSum > 0 ? 100 : 0;

  const weekdayPairs = thisWeek.map((d, i) => ({
    label: weekdayLabel(d.date),
    thisWeek: d.count,
    lastWeek: lastWeek[i]?.count ?? 0,
  }));

  return { today, yesterday, todayDeltaPct, thisWeekSum, lastWeekSum, weekDeltaPct, weekdayPairs };
}

function DeltaChip({ pct }: { pct: number }) {
  const flat = Math.abs(pct) < 0.5;
  const up = pct >= 0;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums"
      style={{ backgroundColor: flat ? tint('primary', 12) : up ? tint('success', 14) : tint('destructive', 14), color: flat ? 'var(--muted-foreground)' : up ? 'var(--success)' : 'var(--destructive)' }}
    >
      {flat ? null : up ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
      {flat ? 'flat' : `${up ? '+' : ''}${pct.toFixed(0)}%`}
    </span>
  );
}

interface KpiTile {
  key: string;
  label: string;
  icon: LucideIcon;
  accent: Accent;
  value: number | string;
  delta?: number;
}

export function AttendanceKpis({ summary, loading }: { summary: AttendanceSummary | undefined; loading: boolean }) {
  const { todayDeltaPct } = computeTrendMetrics(summary?.trend);
  const tiles: KpiTile[] = [
    { key: 'checkins', label: 'Check-ins today', icon: LogIn, accent: 'success', value: summary?.totalCheckInsToday ?? 0, delta: summary ? todayDeltaPct : undefined },
    { key: 'checkouts', label: 'Check-outs today', icon: LogOut, accent: 'aqua', value: summary?.totalCheckOutsToday ?? 0 },
    { key: 'inside', label: 'Currently inside', icon: DoorOpen, accent: 'primary', value: summary?.currentlyInside ?? 0 },
    { key: 'peak', label: 'Peak check-in time', icon: Clock3, accent: 'violet', value: summary ? formatHour(summary.peakCheckInHour) : '—' },
  ];

  return (
    <section aria-label="Attendance figures" className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {tiles.map((t, i) => (
        <motion.div key={t.key} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} whileHover={{ y: -3 }} transition={{ duration: 0.45, delay: 0.04 * i }}>
          <div
            className="h-full w-full rounded-2xl border p-3.5 shadow-xs transition-shadow hover:shadow-md"
            style={{ backgroundImage: `linear-gradient(160deg, ${tint(t.accent, 13)}, transparent 72%)`, borderColor: tint(t.accent, 22) }}
          >
            <div className="flex items-start justify-between gap-2">
              <IconChip icon={t.icon} accent={t.accent} className="size-8" />
              {t.delta !== undefined ? <DeltaChip pct={t.delta} /> : null}
            </div>
            <div className="mt-2.5 text-2xl font-extrabold leading-tight tabular-nums" style={{ color: accentVar(t.accent) }}>
              {loading ? <Skeleton className="h-7 w-14" /> : typeof t.value === 'number' ? <CountUp value={t.value} /> : t.value}
            </div>
            <div className="text-xs font-medium text-muted-foreground">{t.label}</div>
          </div>
        </motion.div>
      ))}
    </section>
  );
}

function TrendPanel({ trend, loading }: { trend: AttendanceSummary['trend'] | undefined; loading: boolean }) {
  const metrics = computeTrendMetrics(trend);
  const data = (trend ?? []).map((p) => ({ ...p, label: p.date.slice(5) }));
  const isEmpty = !loading && data.every((p) => p.count === 0);

  return (
    <PanelCard
      icon={TrendingUp}
      accent="primary"
      title="Attendance trend"
      delay={0.14}
      right={
        !loading && trend ? (
          <div className="flex items-center gap-2 text-[11.5px]">
            <span className="text-muted-foreground">This week {metrics.thisWeekSum} · Last week {metrics.lastWeekSum}</span>
            <DeltaChip pct={metrics.weekDeltaPct} />
          </div>
        ) : null
      }
    >
      {loading ? (
        <Skeleton className="h-[280px] w-full" />
      ) : isEmpty ? (
        <div className="grid h-[280px] place-items-center text-sm text-muted-foreground">No check-ins in this period yet.</div>
      ) : (
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id="fill-attendance-trend" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.32} />
                  <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 4" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} interval={Math.max(0, Math.ceil(data.length / 6) - 1)} />
              <YAxis allowDecimals={false} tick={AXIS} tickLine={false} axisLine={false} width={28} />
              <Tooltip {...TOOLTIP_STYLE} cursor={{ fill: 'var(--accent)', opacity: 0.4 }} labelFormatter={(label, payload) => payload[0]?.payload.date ?? label} />
              <Area dataKey="count" name="Check-ins" stroke="var(--chart-1)" strokeWidth={2.5} fill="url(#fill-attendance-trend)" animationDuration={900} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </PanelCard>
  );
}

function WeekdayComparisonPanel({ trend, loading }: { trend: AttendanceSummary['trend'] | undefined; loading: boolean }) {
  const { weekdayPairs } = computeTrendMetrics(trend);
  const isEmpty = !loading && weekdayPairs.every((d) => d.thisWeek === 0 && d.lastWeek === 0);

  return (
    <PanelCard icon={TrendingUp} accent="violet" title="This week vs last week" delay={0.2}>
      {loading ? (
        <Skeleton className="h-[220px] w-full" />
      ) : isEmpty || weekdayPairs.length === 0 ? (
        <div className="grid h-[220px] place-items-center text-sm text-muted-foreground">Not enough history yet.</div>
      ) : (
        <div className="h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weekdayPairs}>
              <CartesianGrid strokeDasharray="3 4" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} />
              <YAxis allowDecimals={false} tick={AXIS} tickLine={false} axisLine={false} width={24} />
              <Tooltip {...TOOLTIP_STYLE} cursor={{ fill: 'var(--accent)', opacity: 0.4 }} />
              <Legend wrapperStyle={{ fontSize: 11.5 }} />
              <Bar dataKey="lastWeek" name="Last week" fill={tint('violet', 35)} radius={[5, 5, 0, 0]} animationDuration={800} />
              <Bar dataKey="thisWeek" name="This week" fill="var(--chart-7)" radius={[5, 5, 0, 0]} animationDuration={1000} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </PanelCard>
  );
}

const METHOD_ACCENT: Record<AttendanceMethod, Accent> = {
  QR_CODE: 'primary',
  MANUAL: 'violet',
  BIOMETRIC: 'aqua',
  FACE_RECOGNITION: 'warning',
  NFC: 'success',
  RFID: 'destructive',
};
const METHOD_LABEL: Record<AttendanceMethod, string> = {
  QR_CODE: 'QR Code',
  MANUAL: 'Manual',
  BIOMETRIC: 'Biometric',
  FACE_RECOGNITION: 'Face Recognition',
  NFC: 'NFC',
  RFID: 'RFID',
};

function MethodDonutPanel({ records, loading }: { records: AttendanceRecord[] | undefined; loading: boolean }) {
  const counts = new Map<AttendanceMethod, number>();
  (records ?? []).forEach((r) => counts.set(r.method, (counts.get(r.method) ?? 0) + 1));
  const data = [...counts.entries()].map(([method, count]) => ({ method, count, label: METHOD_LABEL[method] }));
  const total = data.reduce((s, d) => s + d.count, 0);

  return (
    <PanelCard icon={PieChartIcon} accent="aqua" title="Today's methods" delay={0.26}>
      {loading ? (
        <Skeleton className="h-[220px] w-full" />
      ) : total === 0 ? (
        <div className="grid h-[220px] place-items-center text-sm text-muted-foreground">No check-ins recorded today.</div>
      ) : (
        <div className="flex flex-col items-center gap-3">
          <div className="h-[170px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data} dataKey="count" nameKey="label" innerRadius={48} outerRadius={72} paddingAngle={3} animationDuration={900}>
                  {data.map((d) => (
                    <Cell key={d.method} fill={accentVar(METHOD_ACCENT[d.method])} stroke="var(--card)" strokeWidth={2} />
                  ))}
                </Pie>
                <Tooltip {...TOOLTIP_STYLE} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="grid w-full grid-cols-2 gap-x-3 gap-y-1 text-[12px]">
            {data.map((d) => (
              <li key={d.method} className="flex items-center gap-1.5">
                <i className="size-2.5 shrink-0 rounded-[3px]" style={{ background: accentVar(METHOD_ACCENT[d.method]) }} />
                <span className="truncate">{d.label}</span>
                <b className="ml-auto tabular-nums">{d.count}</b>
              </li>
            ))}
          </ul>
        </div>
      )}
    </PanelCard>
  );
}

export function ActivityFeedPanel({ records, loading }: { records: AttendanceRecord[] | undefined; loading: boolean }) {
  const items = records ?? [];
  return (
    <PanelCard icon={UserCheck} accent="success" title="Today's activity" delay={0.32} right={<span className="rounded-full px-2.5 py-0.5 text-[11px] font-bold tabular-nums" style={{ backgroundColor: tint('success', 14), color: 'var(--success)' }}>{items.length}</span>}>
      <div className="max-h-80 space-y-1 overflow-y-auto">
        {loading ? (
          <Skeleton className="h-40 w-full" />
        ) : items.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No attendance recorded yet today.</p>
        ) : (
          items.map((record, i) => (
            <motion.div
              key={record.id}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: Math.min(i * 0.03, 0.4) }}
              className="flex items-center justify-between gap-2 rounded-xl px-1.5 py-2 text-sm transition-colors hover:bg-accent/40"
            >
              <Link href={`/members/${record.member.id}`} className="flex min-w-0 items-center gap-2.5">
                <span
                  className="flex size-8 shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold text-white"
                  style={{ backgroundImage: `linear-gradient(135deg, ${accentVar(METHOD_ACCENT[record.method])}, var(--chart-7))` }}
                >
                  {record.member.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase()}
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-medium">{record.member.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {new Date(record.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    {record.checkOutTime ? ` – ${new Date(record.checkOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
                  </span>
                </span>
              </Link>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <AttendanceStatusBadge status={record.status} />
                <AttendanceMethodBadge method={record.method} />
              </div>
            </motion.div>
          ))
        )}
      </div>
    </PanelCard>
  );
}

export function AttendanceInsights({ summary, today, loading }: { summary: AttendanceSummary | undefined; today: AttendanceRecord[] | undefined; loading: boolean }) {
  return (
    <div className="space-y-4">
      <section aria-label="Attendance trend and methods" className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <TrendPanel trend={summary?.trend} loading={loading} />
        </div>
        <MethodDonutPanel records={today} loading={loading} />
      </section>
      <section aria-label="Weekly comparison and activity" className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <WeekdayComparisonPanel trend={summary?.trend} loading={loading} />
        </div>
        <ActivityFeedPanel records={today} loading={loading} />
      </section>
    </div>
  );
}
