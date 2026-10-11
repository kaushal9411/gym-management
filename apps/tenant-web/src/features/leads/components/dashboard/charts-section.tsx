'use client';

import * as React from 'react';

import { useBranches } from '@/features/branch/hooks/use-branches';
import type { AnalyticsRangeKey, LeadAnalytics } from '../../types';
import { AgeingCard, BranchesCard, LostReasonsCard, PlanInterestCard, SourceConversionCard, SourceDonutCard, StaffBoardCard } from './breakdown-charts';
import { FunnelCard, TrendChart } from './trend-funnel-charts';

export function ChartsSection({ data, loading, error, range }: { data: LeadAnalytics | undefined; loading: boolean; error: boolean; range: AnalyticsRangeKey }) {
  const branches = useBranches();
  const p = { data, loading, error };
  const showBranches = (branches.data?.length ?? 0) > 1;
  return (
    <section aria-label="Lead analytics" className="space-y-3.5">
      <div className="grid gap-3.5 xl:grid-cols-5">
        <div className="min-w-0 xl:col-span-3"><TrendChart {...p} range={range} /></div>
        <div className="min-w-0 xl:col-span-2"><FunnelCard {...p} /></div>
      </div>
      <div className="grid gap-3.5 lg:grid-cols-2 xl:grid-cols-3">
        <SourceDonutCard {...p} />
        <SourceConversionCard {...p} />
        <StaffBoardCard {...p} />
      </div>
      <div className={showBranches ? 'grid gap-3.5 lg:grid-cols-2 xl:grid-cols-4' : 'grid gap-3.5 lg:grid-cols-3'}>
        <LostReasonsCard {...p} />
        <PlanInterestCard {...p} />
        <AgeingCard {...p} />
        {showBranches ? <BranchesCard {...p} /> : null}
      </div>
    </section>
  );
}
