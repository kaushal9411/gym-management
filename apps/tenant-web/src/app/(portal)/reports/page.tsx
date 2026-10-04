'use client';

import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { PeriodBar } from '@/features/finance/components/payments/period-bar';
import { ScheduledReportsPanel } from '@/features/reports/components/scheduled-reports-panel';
import { Reveal } from '@/features/reports/components/ui';
import { HubCatalogue } from '@/features/reports/components/hub/hub-catalogue';
import { HubHero, SCHEDULED_PANEL_ID } from '@/features/reports/components/hub/hub-hero';
import { HubKpis } from '@/features/reports/components/hub/hub-kpis';
import { HubInsights } from '@/features/reports/components/hub/hub-sections';
import { useReportsOverview } from '@/features/reports/hooks/use-reports';
import { useReportsControls } from '@/features/reports/hooks/use-reports-controls';

export default function ReportsHubPage() {
  const { hasPermission } = usePermissions();
  const c = useReportsControls('month');
  const canView = hasPermission('reports:view');
  const q = useReportsOverview(c.params, canView && c.rangeReady);

  if (!canView) {
    return <p className="text-sm text-muted-foreground">You don&apos;t have access to reports.</p>;
  }

  const overview = q.data;
  const loading = q.isPending && c.rangeReady;
  const error = q.isError && !overview;
  const periodLabel = c.rangeReady ? `${c.range.from} to ${c.range.to}` : 'select a valid range';
  const shared = { overview, loading, error, compare: c.compare, previousLabel: c.previousLabel };

  return (
    <div className="min-w-0 space-y-5">
      <HubHero overview={overview} loading={loading} periodLabel={periodLabel} />
      <Reveal>
        <PeriodBar
          period={c.period}
          onPeriod={c.changePeriod}
          customFrom={c.custom.from}
          customTo={c.custom.to}
          onCustom={c.setDates}
          branchId={c.branchId}
          onBranch={c.changeBranch}
          compare={c.compare}
          onCompare={c.setCompare}
        />
      </Reveal>
      <HubKpis overview={overview} loading={loading} compare={c.compare} />
      <HubInsights {...shared} />
      <HubCatalogue />
      <Reveal id={SCHEDULED_PANEL_ID} className="scroll-mt-4">
        <ScheduledReportsPanel />
      </Reveal>
    </div>
  );
}
