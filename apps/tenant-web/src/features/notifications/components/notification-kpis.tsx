'use client';

import { BellRing, CheckCheck, Gauge, Inbox } from 'lucide-react';

import { KpiTile, StaggerGroup } from '@/features/reports/components/ui';
import type { NotificationStats } from '../types';

/** Four KPI tiles from `stats.kpis`. "Read" is tenant-wide (read by your team), never per user. */
export function NotificationKpis({ stats, loading, compare, sparkline }: { stats?: NotificationStats; loading: boolean; compare: boolean; sparkline?: number[] }) {
  const k = stats?.kpis;
  return (
    <StaggerGroup className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
      <KpiTile label="Received" icon={Inbox} accent="analytics" value={k?.total.value ?? 0} previous={compare ? k?.total.previous : null} sparkline={sparkline} loading={loading} hint="in this period" />
      <KpiTile label="Unread" icon={BellRing} accent="staff" value={k?.unread.value ?? 0} loading={loading} hint="waiting for your team" />
      <KpiTile label="Read by your team" icon={CheckCheck} accent="finance" value={k?.read.value ?? 0} previous={compare ? k?.read.previous : null} loading={loading} />
      <KpiTile label="Read rate" icon={Gauge} accent="attendance" format="percent" value={(k?.readRate.value ?? 0) * 100} previous={compare && k ? k.readRate.previous * 100 : null} loading={loading} hint="of received" />
    </StaggerGroup>
  );
}
