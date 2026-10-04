'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

import { DonutChart, HBarChart } from '../../charts';
import { ChartCard, SegmentedTabs } from '../ui';
import { num } from '../../lib/format';
import { GOOD_COLOR, BAD_COLOR, NEUTRAL_COLOR, seriesColor } from '../../lib/reports-theme';
import { titleCase, type HubOverview } from './hub-utils';

interface Props {
  overview: HubOverview;
  loading: boolean;
  error: boolean;
}

function statusColor(status: string, i: number): string {
  const s = status.toLowerCase();
  if (s === 'active') return GOOD_COLOR;
  if (s === 'expired' || s === 'cancelled' || s === 'canceled') return BAD_COLOR;
  if (s === 'inactive' || s === 'frozen' || s === 'paused') return NEUTRAL_COLOR;
  return seriesColor(i);
}

export function HubStatusCard({ overview, loading, error }: Props) {
  const src = overview?.memberStatus;
  const data = React.useMemo(() => (src ?? []).map((s, i) => ({ label: titleCase(s.status), value: s.count, color: statusColor(s.status, i) })), [src]);
  const total = data.reduce((a, b) => a + b.value, 0);
  return (
    <ChartCard title="Member status" subtitle="Members by current status" loading={loading} error={error} empty={total === 0} minHeight={260}>
      <DonutChart data={data} centerLabel="Members" centerValue={total.toLocaleString()} />
    </ChartCard>
  );
}

export function HubPlansCard({ overview, loading, error }: Props) {
  const [mode, setMode] = React.useState<'members' | 'revenue'>('members');
  const src = overview?.planDistribution;
  const data = React.useMemo(
    () => (src ?? []).map((p) => ({ label: p.planName, value: mode === 'members' ? p.activeCount : num(p.revenue) })),
    [src, mode],
  );
  return (
    <ChartCard
      title="Plan distribution"
      subtitle={mode === 'members' ? 'Active members per plan' : 'Revenue per plan this period'}
      loading={loading}
      error={error}
      empty={!src?.length}
      actions={
        <SegmentedTabs
          size="sm"
          accent="members"
          ariaLabel="Plan metric"
          value={mode}
          onChange={setMode}
          options={[
            { value: 'members', label: 'Members' },
            { value: 'revenue', label: 'Revenue' },
          ]}
        />
      }
    >
      <HBarChart key={mode} data={data} format={mode === 'members' ? 'number' : 'money'} color={mode === 'members' ? 'var(--chart-1)' : 'var(--chart-2)'} rankBadges />
    </ChartCard>
  );
}

export function HubExpiringCard({ overview, loading, error }: Props) {
  const src = overview?.expiringBuckets;
  const total = (src ?? []).reduce((a, b) => a + b.count, 0);
  return (
    <ChartCard
      title="Expiring memberships"
      subtitle="Upcoming renewals by time window"
      loading={loading}
      error={error}
      empty={!src?.length || total === 0}
      emptyText="No memberships expiring soon"
      actions={
        <Link href="/reports/expiring-memberships" className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline">
          View report <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      }
    >
      <HBarChart data={(src ?? []).map((b) => ({ label: b.label, value: b.count }))} sort={false} color="var(--chart-4)" />
    </ChartCard>
  );
}
