'use client';

import { ArrowRight, CalendarClock, Sparkles } from 'lucide-react';

import { HeroButton } from '@/features/finance/components/payments/payments-hero';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { ReportsHero } from '../ui';
import { num } from '../../lib/format';
import type { HubOverview } from './hub-utils';

export const SCHEDULED_PANEL_ID = 'scheduled-reports';

export function HubHero({ overview, loading, periodLabel }: { overview: HubOverview; loading: boolean; periodLabel: string }) {
  const { hasPermission } = usePermissions();
  const k = overview?.kpis;
  const scrollToSchedule = () => document.getElementById(SCHEDULED_PANEL_ID)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  return (
    <ReportsHero
      eyebrow="Insights"
      icon={Sparkles}
      title="Reports & Insights"
      subtitle={`Performance, attendance and member trends in one place - ${periodLabel}.`}
      accent="analytics"
      statsLoading={loading && !k}
      stats={[
        { label: 'Revenue', value: num(k?.revenue.value), format: 'money' },
        { label: 'Net profit', value: num(k?.netProfit.value), format: 'money' },
        { label: 'New members', value: k?.newMembers.value ?? 0 },
        { label: 'Check-ins', value: k?.checkIns.value ?? 0 },
      ]}
      actions={
        <>
          {hasPermission('analytics:view') ? (
            <HeroButton href="/analytics" solid>
              Open analytics <ArrowRight className="size-4" aria-hidden />
            </HeroButton>
          ) : null}
          {hasPermission('reports:export') ? (
            <HeroButton onClick={scrollToSchedule}>
              <CalendarClock className="size-4" aria-hidden /> Schedule report
            </HeroButton>
          ) : null}
        </>
      }
    />
  );
}
