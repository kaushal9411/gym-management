import { Clock3, DoorOpen, LogIn, LogOut } from 'lucide-react';

import { StatisticCard } from '@/components/ui/statistic-card';
import type { AttendanceSummary } from '../types';

function formatHour(hour: number | null): string {
  if (hour === null) return '—';
  const period = hour < 12 ? 'AM' : 'PM';
  const twelveHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${twelveHour}:00 ${period}`;
}

interface AttendanceSummaryCardsProps {
  summary: AttendanceSummary | undefined;
  loading?: boolean;
}

export function AttendanceSummaryCards({ summary, loading }: AttendanceSummaryCardsProps) {
  const cards = [
    { key: 'check-ins', label: 'Check-ins today', icon: LogIn, value: summary?.totalCheckInsToday ?? 0 },
    { key: 'check-outs', label: 'Check-outs today', icon: LogOut, value: summary?.totalCheckOutsToday ?? 0 },
    { key: 'inside', label: 'Currently inside', icon: DoorOpen, value: summary?.currentlyInside ?? 0 },
    { key: 'peak', label: 'Peak check-in time', icon: Clock3, value: summary ? formatHour(summary.peakCheckInHour) : '—' },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <StatisticCard key={card.key} label={card.label} value={card.value} icon={card.icon} loading={loading} />
      ))}
    </div>
  );
}
