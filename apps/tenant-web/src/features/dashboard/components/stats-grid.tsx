'use client';

import { CalendarClock, UserCheck, UserPlus, Users, Wallet, Clock3 } from 'lucide-react';

import { StatisticCard } from '@/components/ui/statistic-card';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { useKpis } from '@/features/reports/hooks/use-reports';

/** Real KPIs from the Reports & Analytics module (Prompt 20) — the Prompt-10 foundation's "Coming soon" placeholders finally have data behind them, now that Members/Attendance/Memberships/Payments all exist. */
export function StatsGrid() {
  const { hasPermission } = usePermissions();
  const kpis = useKpis();
  const data = kpis.data;

  const stats = [
    { key: 'attendance', label: "Today's Attendance", icon: UserCheck, value: data?.todaysAttendance },
    { key: 'active-members', label: 'Active Members', icon: Users, value: data?.activeMembers },
    { key: 'expiring-memberships', label: 'Expiring Memberships', icon: CalendarClock, value: data?.expiringMemberships },
    { key: 'new-registrations', label: 'New Members (this month)', icon: UserPlus, value: data?.newMembersThisMonth },
    { key: 'revenue-summary', label: 'Monthly Revenue', icon: Wallet, value: data ? `$${data.monthlyRevenue}` : undefined },
    { key: 'pending-payments', label: 'Outstanding Payments', icon: Clock3, value: data ? `$${data.outstandingPayments}` : undefined },
  ] as const;

  if (!hasPermission('reports:view')) return null;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {stats.map((stat) => (
        <StatisticCard key={stat.key} label={stat.label} value={stat.value ?? '—'} icon={stat.icon} loading={kpis.isPending} />
      ))}
    </div>
  );
}
