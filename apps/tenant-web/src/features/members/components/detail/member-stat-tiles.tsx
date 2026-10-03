'use client';

import { motion } from 'framer-motion';
import { CalendarClock, CalendarDays, CircleDollarSign, Flame, Hourglass, Wallet, type LucideIcon } from 'lucide-react';

import { useAttendanceList, useMemberAttendance } from '@/features/attendance/hooks/use-attendance';
import type { MemberDetail } from '@/features/members/types';
import { useCurrencySymbol } from '@/lib/currency';
import { Accent, CountUp, IconChip, accentVar, tint } from './detail-ui';
import { toIsoDate } from './date-utils';
import { useMemberMoney } from './use-member-money';

interface Tile {
  key: string;
  label: string;
  icon: LucideIcon;
  accent: Accent;
  value: React.ReactNode;
}

function lastVisitLabel(iso: string | undefined): string {
  if (!iso) return '—';
  const days = Math.floor((new Date().setHours(0, 0, 0, 0) - new Date(iso).setHours(0, 0, 0, 0)) / 86_400_000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return `${days} days ago`;
}

export function MemberStatTiles({ data }: { data: MemberDetail }) {
  const symbol = useCurrencySymbol();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const month = useAttendanceList({ memberId: data.id, dateFrom: toIsoDate(monthStart), dateTo: toIsoDate(monthEnd), page: 1, limit: 1 });
  const overall = useMemberAttendance(data.id, 1, 1);
  const { totalPaid, due } = useMemberMoney(data.id, data.outstandingAmount);

  const endDate = data.currentMembership ? new Date(data.currentMembership.endDate) : null;
  const daysLeft = endDate ? Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / 86_400_000)) : 0;
  const lastVisit = overall.data?.items[0]?.checkInTime;

  const tiles: Tile[] = [
    {
      key: 'month',
      label: `Visits in ${now.toLocaleString(undefined, { month: 'short', year: 'numeric' })}`,
      icon: CalendarDays,
      accent: 'primary',
      value: <CountUp value={month.data?.total ?? 0} />,
    },
    { key: 'total', label: 'Total visits', icon: Flame, accent: 'violet', value: <CountUp value={overall.data?.total ?? 0} /> },
    {
      key: 'last',
      label: lastVisit ? `Last visit · ${new Date(lastVisit).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Last visit',
      icon: CalendarClock,
      accent: 'aqua',
      value: <span className="text-xl">{lastVisitLabel(lastVisit)}</span>,
    },
    {
      key: 'paid',
      label: 'Total paid',
      icon: Wallet,
      accent: 'success',
      value: (
        <>
          {symbol}
          <CountUp value={totalPaid} />
        </>
      ),
    },
    {
      key: 'due',
      label: 'Due now',
      icon: CircleDollarSign,
      accent: due > 0 ? 'destructive' : 'success',
      value: (
        <>
          {symbol}
          <CountUp value={due} />
        </>
      ),
    },
    {
      key: 'left',
      label: 'Left on membership',
      icon: Hourglass,
      accent: daysLeft <= 7 && endDate ? 'warning' : 'primary',
      value: endDate ? (
        <>
          <CountUp value={daysLeft} /> <span className="text-base font-bold">days</span>
        </>
      ) : (
        <span className="text-xl">No plan</span>
      ),
    },
  ];

  return (
    <section aria-label="Summary" className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
      {tiles.map((tile, i) => (
        <motion.div
          key={tile.key}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          whileHover={{ y: -3 }}
          transition={{ duration: 0.45, delay: 0.05 * i }}
          className="rounded-2xl border p-4 shadow-xs"
          style={{
            backgroundImage: `linear-gradient(160deg, ${tint(tile.accent, 14)}, transparent 70%)`,
            borderColor: tint(tile.accent, 25),
          }}
        >
          <IconChip icon={tile.icon} accent={tile.accent} />
          <div className="mt-3 text-2xl font-extrabold leading-tight tracking-tight tabular-nums" style={{ color: accentVar(tile.accent) }}>
            {tile.value}
          </div>
          <div className="mt-0.5 text-xs font-medium text-muted-foreground">{tile.label}</div>
        </motion.div>
      ))}
    </section>
  );
}
