'use client';

import { Activity, CalendarClock, CalendarDays, Coins, Receipt, TrendingUp, UserMinus, UserPlus, Users } from 'lucide-react';

import { KpiTile, StaggerGroup } from '../ui';
import { num } from '../../lib/format';
import type { HubOverview } from './hub-utils';

export function HubKpis({ overview, loading, compare }: { overview: HubOverview; loading: boolean; compare: boolean }) {
  const k = overview?.kpis;
  const daily = overview?.daily ?? [];
  const prev = <T,>(v: T | undefined) => (compare ? v : undefined);
  const pm = (v: string | undefined) => (compare && v !== undefined ? num(v) : undefined);
  const l = loading && !k;
  return (
    <StaggerGroup step={0.05} className="grid grid-cols-1 gap-3.5 min-[480px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      <KpiTile loading={l} label="Revenue" icon={Coins} accent="finance" format="money" compact value={num(k?.revenue.value)} previous={pm(k?.revenue.previous)} sparkline={daily.map((d) => num(d.revenue))} />
      <KpiTile loading={l} label="Expenses" icon={Receipt} accent="operations" format="money" compact invert value={num(k?.expenses.value)} previous={pm(k?.expenses.previous)} sparkline={daily.map((d) => num(d.expenses))} />
      <KpiTile loading={l} label="Net profit" icon={TrendingUp} accent="finance" format="money" compact value={num(k?.netProfit.value)} previous={pm(k?.netProfit.previous)} sparkline={daily.map((d) => num(d.revenue) - num(d.expenses))} />
      <KpiTile loading={l} label="New members" icon={UserPlus} accent="members" value={k?.newMembers.value ?? 0} previous={prev(k?.newMembers.previous)} sparkline={daily.map((d) => d.newMembers)} />
      <KpiTile loading={l} label="Active members" icon={Users} accent="members" value={k?.activeMembers.value ?? 0} hint="right now" />
      <KpiTile loading={l} label="Check-ins" icon={Activity} accent="attendance" value={k?.checkIns.value ?? 0} previous={prev(k?.checkIns.previous)} sparkline={daily.map((d) => d.checkIns)} />
      <KpiTile loading={l} label="Avg daily check-ins" icon={CalendarDays} accent="attendance" value={k?.avgDailyCheckIns.value ?? 0} previous={prev(k?.avgDailyCheckIns.previous)} />
      <KpiTile loading={l} label="Expiring in 30d" icon={CalendarClock} accent="staff" value={k?.expiringIn30d.value ?? 0} hint="memberships" />
      <KpiTile loading={l} label="Churned" icon={UserMinus} accent="staff" invert value={k?.churned.value ?? 0} previous={prev(k?.churned.previous)} />
    </StaggerGroup>
  );
}
