'use client';

import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Activity, UserPlus, Wallet } from 'lucide-react';

import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { useCurrentBranch } from '@/features/branch/hooks/use-branches';
import { PanelCard, formatMoney, tint } from '@/features/members/components/detail/detail-ui';
import { useAttendanceTrends, useNewMemberGrowth, useRevenueTrends } from '@/features/reports/hooks/use-reports';
import { useCurrencySymbol } from '@/lib/currency';
import { useDashboardRange } from '../hooks/use-dashboard-range';

const AXIS_TICK = { fill: 'var(--muted-foreground)', fontSize: 12 };
const TOOLTIP_STYLE = {
  contentStyle: {
    background: 'var(--popover)',
    color: 'var(--popover-foreground)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    boxShadow: 'var(--shadow-md)',
    fontSize: 12,
  },
  labelStyle: { color: 'var(--foreground)', fontWeight: 600, marginBottom: 2 },
  cursor: { stroke: 'var(--muted-foreground)', strokeDasharray: '3 3' },
};

function ChartBox({ loading, empty, message, children }: { loading: boolean; empty: boolean; message: string; children: React.ReactElement }) {
  if (loading) return <Skeleton className="h-[240px] w-full" />;
  if (empty) {
    return (
      <div className="flex h-[240px] items-center justify-center">
        <EmptyState title={message} />
      </div>
    );
  }
  return (
    <div className="h-[240px]">
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  );
}

function Gradient({ id, color }: { id: string; color: string }) {
  return (
    <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor={color} stopOpacity={0.32} />
      <stop offset="100%" stopColor={color} stopOpacity={0.02} />
    </linearGradient>
  );
}

function SumTile({ value, label, color }: { value: string; label: string; color: string }) {
  return (
    <div className="rounded-xl border p-3" style={{ backgroundColor: `color-mix(in oklch, ${color} 9%, transparent)`, borderColor: `color-mix(in oklch, ${color} 20%, transparent)` }}>
      <b className="block text-xl font-extrabold tabular-nums">{value}</b>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

/** Income vs expenses for the selected range, with totals and net profit. */
export function MoneyChartPanel() {
  const symbol = useCurrencySymbol();
  const { hasPermission } = usePermissions();
  const { currentBranchId } = useCurrentBranch();
  const { dateFrom, dateTo } = useDashboardRange();
  const revenue = useRevenueTrends(dateFrom, dateTo, currentBranchId ?? undefined);
  if (!hasPermission('analytics:view')) return null;

  const data = (revenue.data ?? []).map((p) => ({ ...p, label: p.date.slice(5) }));
  const income = data.reduce((s, p) => s + p.income, 0);
  const expenses = data.reduce((s, p) => s + p.expenses, 0);
  const net = income - expenses;

  return (
    <PanelCard
      icon={Wallet}
      accent="success"
      title="Income vs expenses"
      delay={0.3}
      right={
        <span className="rounded-full px-2.5 py-0.5 text-[11px] font-bold" style={{ backgroundColor: tint(net >= 0 ? 'success' : 'destructive', 14), color: net >= 0 ? 'var(--success)' : 'var(--destructive)' }}>
          Net {net >= 0 ? '+' : '-'}
          {formatMoney(symbol, Math.abs(net))}
        </span>
      }
    >
      <div className="grid grid-cols-3 gap-2.5">
        <SumTile value={formatMoney(symbol, income)} label="Income" color="var(--success)" />
        <SumTile value={formatMoney(symbol, expenses)} label="Expenses" color="var(--destructive)" />
        <SumTile value={formatMoney(symbol, net)} label="Net profit" color="var(--primary)" />
      </div>
      <div className="flex gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><i className="size-2.5 rounded-[3px]" style={{ background: 'var(--success)' }} />Income</span>
        <span className="flex items-center gap-1.5"><i className="size-2.5 rounded-[3px]" style={{ background: 'var(--destructive)' }} />Expenses</span>
      </div>
      <ChartBox loading={revenue.isPending} empty={data.every((d) => d.income === 0 && d.expenses === 0)} message="No income or expenses in this period yet.">
        <AreaChart data={data}>
          <defs>
            <Gradient id="dash-income" color="var(--success)" />
            <Gradient id="dash-expenses" color="var(--destructive)" />
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={false} minTickGap={24} />
          <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} width={44} tickFormatter={(v: number) => (v >= 1000 ? `${Number((v / 1000).toFixed(1))}k` : String(Math.round(v)))} />
          <Tooltip {...TOOLTIP_STYLE} labelFormatter={(label, payload) => payload[0]?.payload.date ?? label} formatter={(v, name) => [formatMoney(symbol, Number(v)), String(name)]} />
          <Area dataKey="income" name="Income" stroke="var(--success)" strokeWidth={2.4} fill="url(#dash-income)" animationDuration={1200} />
          <Area dataKey="expenses" name="Expenses" stroke="var(--destructive)" strokeWidth={2.4} fill="url(#dash-expenses)" animationDuration={1200} />
        </AreaChart>
      </ChartBox>
    </PanelCard>
  );
}

export function AttendanceChartPanel() {
  const { hasPermission } = usePermissions();
  const { currentBranchId } = useCurrentBranch();
  const { dateFrom, dateTo, days } = useDashboardRange();
  const attendance = useAttendanceTrends(dateFrom, dateTo, currentBranchId ?? undefined);
  if (!hasPermission('analytics:view')) return null;

  const data = (attendance.data ?? []).map((p) => ({ ...p, label: p.date.slice(5) }));
  const total = data.reduce((s, p) => s + p.value, 0);

  return (
    <PanelCard
      icon={Activity}
      accent="aqua"
      title="Attendance"
      delay={0.36}
      right={<span className="rounded-full px-2.5 py-0.5 text-[11px] font-bold tabular-nums" style={{ backgroundColor: tint('aqua', 14), color: 'var(--chart-3)' }}>Avg {Math.round(total / days)} / day</span>}
    >
      <ChartBox loading={attendance.isPending} empty={data.every((d) => d.value === 0)} message="No attendance recorded in this period yet.">
        <AreaChart data={data}>
          <defs>
            <Gradient id="dash-att" color="var(--chart-3)" />
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={false} minTickGap={24} />
          <YAxis allowDecimals={false} tick={AXIS_TICK} tickLine={false} axisLine={false} width={30} />
          <Tooltip {...TOOLTIP_STYLE} labelFormatter={(label, payload) => payload[0]?.payload.date ?? label} />
          <Area dataKey="value" name="Check-ins" stroke="var(--chart-3)" strokeWidth={2.4} fill="url(#dash-att)" animationDuration={1200} />
        </AreaChart>
      </ChartBox>
    </PanelCard>
  );
}

export function NewMembersChartPanel() {
  const { hasPermission } = usePermissions();
  const { currentBranchId } = useCurrentBranch();
  const { dateFrom, dateTo } = useDashboardRange();
  const growth = useNewMemberGrowth(dateFrom, dateTo, currentBranchId ?? undefined);
  if (!hasPermission('analytics:view')) return null;

  const data = (growth.data ?? []).map((p) => ({ ...p, label: p.date.slice(5) }));
  const total = data.reduce((s, p) => s + p.value, 0);

  return (
    <PanelCard
      icon={UserPlus}
      accent="violet"
      title="New members"
      delay={0.42}
      right={<span className="rounded-full px-2.5 py-0.5 text-[11px] font-bold tabular-nums" style={{ backgroundColor: tint('violet', 14), color: 'var(--chart-7)' }}>{total} joined</span>}
    >
      <ChartBox loading={growth.isPending} empty={data.every((d) => d.value === 0)} message="No new members in this period yet.">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={false} minTickGap={24} />
          <YAxis allowDecimals={false} tick={AXIS_TICK} tickLine={false} axisLine={false} width={30} />
          <Tooltip {...TOOLTIP_STYLE} labelFormatter={(label, payload) => payload[0]?.payload.date ?? label} />
          <Bar dataKey="value" name="New members" fill="var(--chart-7)" radius={[5, 5, 0, 0]} animationDuration={1000} />
        </BarChart>
      </ChartBox>
    </PanelCard>
  );
}
