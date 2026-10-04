'use client';

import { HubWeekdayCard, HubHourlyCard } from './hub-attendance';
import { HubBranchesCard, HubTrainersCard } from './hub-branches';
import { HubGaugesCard, HubPaymentMethodsCard } from './hub-finance';
import { HubExpiringCard, HubPlansCard, HubStatusCard } from './hub-members';
import { HubProfitCard, HubTrendCard } from './hub-trend-card';
import type { HubOverview } from './hub-utils';

interface Props {
  overview: HubOverview;
  loading: boolean;
  error: boolean;
  compare: boolean;
  previousLabel: string;
}

/** Responsive insight grid: 1 col phones, 2 cols at lg, 12 cols at xl. */
export function HubInsights(p: Props) {
  const base = { overview: p.overview, loading: p.loading, error: p.error };
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-12">
      <div className="min-w-0 lg:col-span-2 xl:col-span-8">
        <HubTrendCard {...p} />
      </div>
      <div className="min-w-0 xl:col-span-4">
        <HubStatusCard {...base} />
      </div>
      <div className="min-w-0 lg:col-span-2 xl:col-span-12">
        <HubProfitCard {...base} />
      </div>
      <div className="min-w-0 xl:col-span-7">
        <HubWeekdayCard {...p} />
      </div>
      <div className="min-w-0 xl:col-span-5">
        <HubHourlyCard {...base} />
      </div>
      <div className="min-w-0 xl:col-span-7">
        <HubPlansCard {...base} />
      </div>
      <div className="min-w-0 xl:col-span-5">
        <HubPaymentMethodsCard {...base} />
      </div>
      <div className="min-w-0 lg:col-span-2 xl:col-span-12">
        <HubBranchesCard {...p} />
      </div>
      <div className="min-w-0 xl:col-span-6">
        <HubTrainersCard {...base} />
      </div>
      <div className="min-w-0 xl:col-span-6">
        <HubExpiringCard {...base} />
      </div>
      <div className="min-w-0 lg:col-span-2 xl:col-span-12">
        <HubGaugesCard {...base} />
      </div>
    </div>
  );
}
