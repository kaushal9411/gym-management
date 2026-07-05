import { CalendarClock, UserCheck, UserPlus, Users, Wallet, Clock3 } from 'lucide-react';

import { StatisticCard } from '@/components/ui/statistic-card';

/**
 * Foundation-phase placeholders — real values arrive once the Members,
 * Attendance, Memberships, and Payments modules (later prompts) exist.
 * Each card is honest about that via the "Coming soon" trend label
 * rather than showing a fabricated number.
 */
const PLACEHOLDER_STATS = [
  { key: 'attendance', label: "Today's Attendance", icon: UserCheck },
  { key: 'active-members', label: 'Active Members', icon: Users },
  { key: 'expiring-memberships', label: 'Expiring Memberships', icon: CalendarClock },
  { key: 'new-registrations', label: 'New Registrations', icon: UserPlus },
  { key: 'revenue-summary', label: 'Revenue Summary', icon: Wallet },
  { key: 'pending-payments', label: 'Pending Payments', icon: Clock3 },
] as const;

export function StatsGrid() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {PLACEHOLDER_STATS.map((stat) => (
        <StatisticCard
          key={stat.key}
          label={stat.label}
          value="—"
          icon={stat.icon}
          trend={{ direction: 'flat', label: 'Coming soon' }}
        />
      ))}
    </div>
  );
}
