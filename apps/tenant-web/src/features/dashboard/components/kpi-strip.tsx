'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { CalendarClock, CircleDollarSign, HandCoins, TrendingDown, TrendingUp, UserCheck, UserPlus, Users, type LucideIcon } from 'lucide-react';

import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { useCurrentBranch } from '@/features/branch/hooks/use-branches';
import { type Accent, CountUp, IconChip, ProgressBar, accentVar, tint } from '@/features/members/components/detail/detail-ui';
import { useAttendanceTrends, useKpis, useNewMemberGrowth, useRevenueTrends } from '@/features/reports/hooks/use-reports';
import { useCurrencySymbol } from '@/lib/currency';
import { useDashboardRange } from '../hooks/use-dashboard-range';
import { DashboardCardDetailModal, type DashboardStatKind } from './dashboard-detail-modal';

function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return null;
  const W = 200;
  const H = 38;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const points = values.map((v, i) => `${(i / (values.length - 1)) * W},${H - 4 - ((H - 8) * (v - min)) / (max - min || 1)}`);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="mt-2 block h-9 w-full" aria-hidden>
      <motion.path
        d={`M${points.join(' L')}`}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.2, delay: 0.3, ease: 'easeOut' }}
      />
    </svg>
  );
}

interface Tile {
  key: string;
  label: string;
  icon: LucideIcon;
  accent: Accent;
  value: number;
  money?: boolean;
  tag?: string;
  footer?: React.ReactNode;
  stat?: DashboardStatKind;
  href?: string;
}

export function KpiStrip() {
  const router = useRouter();
  const symbol = useCurrencySymbol();
  const { hasPermission } = usePermissions();
  const { currentBranchId } = useCurrentBranch();
  const branchId = currentBranchId ?? undefined;
  const { dateFrom, dateTo } = useDashboardRange();
  const kpis = useKpis(branchId);
  const revenue = useRevenueTrends(dateFrom, dateTo, branchId);
  const attendance = useAttendanceTrends(dateFrom, dateTo, branchId);
  const newMembers = useNewMemberGrowth(dateFrom, dateTo, branchId);
  const [openStat, setOpenStat] = React.useState<DashboardStatKind | null>(null);

  if (!hasPermission('reports:view')) return null;

  const d = kpis.data;
  const income = Number(d?.monthlyRevenue ?? 0);
  const expenses = Number(d?.monthlyExpenses ?? 0);
  const tail = <T,>(arr: T[] | undefined) => (arr ?? []).slice(-14);
  const incomeSeries = tail(revenue.data).map((p) => p.income);
  const expenseSeries = tail(revenue.data).map((p) => p.expenses);
  const activeShare = d && d.totalMembers > 0 ? (d.activeMembers / d.totalMembers) * 100 : 0;

  const tiles: Tile[] = [
    {
      key: 'active', label: 'Active members', icon: Users, accent: 'primary', value: d?.activeMembers ?? 0, tag: `of ${d?.totalMembers ?? 0}`, stat: 'active-members',
      footer: <ProgressBar className="mt-4" percent={activeShare} accent="primary" />,
    },
    {
      key: 'new', label: 'New this month', icon: UserPlus, accent: 'violet', value: d?.newMembersThisMonth ?? 0, stat: 'new-registrations',
      footer: <Sparkline values={tail(newMembers.data).map((p) => p.value)} color={accentVar('violet')} />,
    },
    {
      key: 'checkins', label: "Today's check-ins", icon: UserCheck, accent: 'aqua', value: d?.todaysAttendance ?? 0, stat: 'attendance',
      footer: <Sparkline values={tail(attendance.data).map((p) => p.value)} color={accentVar('aqua')} />,
    },
    {
      key: 'expiring', label: 'Expiring in 30 days', icon: CalendarClock, accent: 'warning', value: d?.expiringMemberships ?? 0, tag: 'renew soon', stat: 'expiring-memberships',
      footer: <ProgressBar className="mt-4" percent={d && d.activeMembers > 0 ? (d.expiringMemberships / d.activeMembers) * 100 : 0} accent="warning" />,
    },
    {
      key: 'income', label: 'Monthly income', icon: HandCoins, accent: 'success', value: income, money: true, stat: 'revenue-summary',
      footer: <Sparkline values={incomeSeries} color={accentVar('success')} />,
    },
    {
      key: 'expenses', label: 'Monthly expenses', icon: TrendingDown, accent: 'destructive', value: expenses, money: true, href: '/expenses',
      footer: <Sparkline values={expenseSeries} color={accentVar('destructive')} />,
    },
    {
      key: 'net', label: 'Net profit', icon: income - expenses >= 0 ? TrendingUp : TrendingDown, accent: income - expenses >= 0 ? 'primary' : 'destructive', value: income - expenses, money: true,
      footer: <Sparkline values={incomeSeries.map((v, i) => v - (expenseSeries[i] ?? 0))} color={accentVar('primary')} />,
    },
    {
      key: 'due', label: 'Outstanding', icon: CircleDollarSign, accent: 'destructive', value: Number(d?.outstandingPayments ?? 0), money: true, stat: 'pending-payments',
    },
  ];

  return (
    <>
      <section aria-label="Key figures" className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        {tiles.map((tile, i) => {
          const clickable = tile.stat || tile.href;
          return (
            <motion.div
              key={tile.key}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ y: -3 }}
              transition={{ duration: 0.45, delay: 0.04 * i }}
              role={clickable ? 'button' : undefined}
              tabIndex={clickable ? 0 : undefined}
              onClick={() => (tile.stat ? setOpenStat(tile.stat) : tile.href ? router.push(tile.href) : undefined)}
              onKeyDown={(e) => {
                if (clickable && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault();
                  if (tile.stat) setOpenStat(tile.stat);
                  else if (tile.href) router.push(tile.href);
                }
              }}
              className={`rounded-2xl border p-4 shadow-xs ${clickable ? 'cursor-pointer focus-visible:outline-2 focus-visible:outline-ring' : ''}`}
              style={{ backgroundImage: `linear-gradient(160deg, ${tint(tile.accent, 13)}, transparent 72%)`, borderColor: tint(tile.accent, 24) }}
            >
              <div className="flex items-center justify-between gap-2">
                <IconChip icon={tile.icon} accent={tile.accent} />
                {tile.tag ? (
                  <span className="rounded-full px-2.5 py-0.5 text-[11px] font-bold" style={{ backgroundColor: tint(tile.accent, 14), color: accentVar(tile.accent) }}>
                    {tile.tag}
                  </span>
                ) : null}
              </div>
              <div className="mt-3 text-[26px] font-extrabold leading-tight tracking-tight tabular-nums" style={{ color: accentVar(tile.accent) }}>
                {tile.money ? symbol : null}
                <CountUp value={tile.value} format={(n) => Math.round(n).toLocaleString()} />
              </div>
              <div className="text-[12.5px] font-medium text-muted-foreground">{tile.label}</div>
              {tile.footer}
            </motion.div>
          );
        })}
      </section>
      <DashboardCardDetailModal kind={openStat} branchId={branchId} onClose={() => setOpenStat(null)} />
    </>
  );
}
