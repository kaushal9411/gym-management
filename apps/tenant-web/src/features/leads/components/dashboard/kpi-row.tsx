'use client';

import * as React from 'react';
import { AlarmClock, CalendarClock, Clock, Percent, UserRoundSearch } from 'lucide-react';

import { KpiTile, StaggerGroup } from '@/features/reports/components/ui';
import { cn } from '@/lib/utils';
import type { LeadAnalytics } from '../../types';

function Clickable({ onClick, label, active, children }: { onClick?: () => void; label: string; active?: boolean; children: React.ReactNode }) {
  if (!onClick) return <>{children}</>;
  return (
    <button type="button" onClick={onClick} aria-label={label} aria-pressed={active} className={cn('block h-full min-w-0 rounded-[20px] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', active && 'ring-2 ring-primary')}>
      {children}
    </button>
  );
}

export function KpiRow({ data, loading, compare, followUp, onFollowUp }: { data: LeadAnalytics | undefined; loading: boolean; compare: boolean; followUp: string; onFollowUp: (v: 'overdue' | 'today' | '') => void }) {
  const k = data?.kpis;
  const prev = (p: number | null | undefined) => (compare ? p : undefined);
  return (
    <StaggerGroup className="grid grid-cols-2 gap-3.5 md:grid-cols-3 xl:grid-cols-5">
      <KpiTile label="Conversion rate" icon={Percent} accent="finance" format="percent" loading={loading} value={Math.round((k?.conversionRate.value ?? 0) * 1000) / 10} previous={prev(k ? Math.round(k.conversionRate.previous * 1000) / 10 : undefined)} hint="of leads created in range" />
      <KpiTile label="Open leads" icon={UserRoundSearch} accent="members" loading={loading} value={k?.open.value ?? 0} hint="all-time, in pipeline" />
      <KpiTile label="Days to convert" icon={Clock} accent="operations" loading={loading} value={k?.avgDaysToConvert.value ?? 0} hint={k && k.avgDaysToConvert.value === null ? 'No conversions in range' : 'in selected range'} previous={prev(k?.avgDaysToConvert.previous)} invert />
      <Clickable label="Show leads with follow-up due today" active={followUp === 'today'} onClick={() => onFollowUp(followUp === 'today' ? '' : 'today')}>
        <KpiTile className="h-full" label="Follow-ups today" icon={CalendarClock} accent="attendance" loading={loading} value={k?.followUpsDueToday.value ?? 0} hint="click to filter" />
      </Clickable>
      <Clickable label="Show leads with overdue follow-up" active={followUp === 'overdue'} onClick={() => onFollowUp(followUp === 'overdue' ? '' : 'overdue')}>
        <KpiTile className="h-full" label="Overdue" icon={AlarmClock} accent="staff" loading={loading} value={k?.followUpsOverdue.value ?? 0} hint="click to filter" />
      </Clickable>
    </StaggerGroup>
  );
}
