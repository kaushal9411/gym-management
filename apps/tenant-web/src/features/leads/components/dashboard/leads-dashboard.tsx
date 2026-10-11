'use client';

import * as React from 'react';
import { Download, KanbanSquare, Plus, Table2 } from 'lucide-react';
import { toast } from 'sonner';

import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { HeroButton, PaymentsHero } from '@/features/finance/components/payments/payments-hero';
import { Chip } from '@/features/finance/components/payments/payments-ui';
import { SegmentedTabs } from '@/features/reports/components/ui';
import { toLeadError, useLeadAnalytics, useLeadList } from '../../hooks/use-leads';
import { useLeadsPageState } from '../../hooks/use-leads-page-state';
import { leadsService } from '../../services/leads.service';
import { ChartsSection } from './charts-section';
import { CreateLeadPanel } from './create-panel';
import { FilterBar } from './filter-bar';
import { FollowUpsPanel } from './follow-ups-panel';
import { HeadlineTiles } from './headline-tiles';
import { KpiRow } from './kpi-row';
import { LeadBoard } from './lead-board';
import { LeadTable } from './lead-table';
import { RangeBar } from './range-bar';

export function LeadsDashboard() {
  const { hasPermission } = usePermissions();
  const canCreate = hasPermission('leads:create');
  const canUpdate = hasPermission('leads:update');
  const canAssign = hasPermission('leads:assign');
  const canExport = hasPermission('leads:export');
  const s = useLeadsPageState();
  const [creating, setCreating] = React.useState(false);
  const [exporting, setExporting] = React.useState(false);

  const analytics = useLeadAnalytics(s.analyticsParams ?? { range: '30d' }, !!s.analyticsParams);
  const list = useLeadList(s.listParams);
  const aLoading = analytics.isPending && !!s.analyticsParams;
  const aError = analytics.isError && !analytics.data;

  const runExport = async () => {
    setExporting(true);
    try {
      await leadsService.exportCsv({ ...s.listFilters, status: s.status ? [s.status] : undefined });
      toast.success('Leads exported.');
    } catch (e) {
      toast.error(toLeadError(e).message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-3.5">
      <PaymentsHero
        eyebrow="Sales & Growth"
        title="Leads & enquiries"
        subtitle="Track every enquiry from first contact to joined member, and see what is converting."
        actions={
          <>
            {canExport ? (
              <HeroButton onClick={runExport} disabled={exporting}>
                <Download className="size-4" aria-hidden /> {exporting ? 'Exporting...' : 'Export CSV'}
              </HeroButton>
            ) : null}
            {canCreate ? (
              <HeroButton solid onClick={() => setCreating((v) => !v)} aria-expanded={creating}>
                <Plus className="size-4" aria-hidden /> New lead
              </HeroButton>
            ) : null}
          </>
        }
      />

      {creating && canCreate ? <CreateLeadPanel canAssign={canAssign} onClose={() => setCreating(false)} /> : null}

      <RangeBar s={s} />
      <HeadlineTiles data={analytics.data} compare={s.compare} />
      {s.range === 'custom' && !s.analyticsParams ? <p className="rounded-xl border border-dashed p-3 text-center text-sm text-muted-foreground">Pick a start and end date to load the charts for a custom range.</p> : null}
      <KpiRow data={analytics.data} loading={aLoading} compare={s.compare} followUp={s.followUp} onFollowUp={(v) => s.set({ fu: v })} />
      <ChartsSection data={analytics.data} loading={aLoading} error={aError} range={s.range} />

      <div className="grid items-start gap-3.5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-3.5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-extrabold">Pipeline</h2>
              <p className="text-[13px] text-muted-foreground">{list.data ? `${list.data.summary.total} lead${list.data.summary.total === 1 ? '' : 's'} match, ${list.data.summary.open} open` : 'Loading leads...'}</p>
            </div>
            <SegmentedTabs
              ariaLabel="Pipeline view"
              value={s.view}
              onChange={(v) => s.set({ view: v === 'board' ? null : v }, false)}
              options={[
                { value: 'board', label: 'Board', icon: KanbanSquare },
                { value: 'table', label: 'Table', icon: Table2 },
              ]}
            />
          </div>
          <FilterBar s={s} counts={list.data?.counts} />
          {s.followUp ? (
            <div className="flex items-center gap-2 text-sm">
              <Chip small active onClick={() => s.set({ fu: null })}>Follow-up: {s.followUp} (clear)</Chip>
            </div>
          ) : null}
          {list.isError && !list.data ? (
            <p role="alert" className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">Could not load leads. Please refresh.</p>
          ) : s.view === 'board' ? (
            <LeadBoard items={list.data?.items ?? []} counts={list.data?.counts} total={list.data?.total ?? 0} status={s.status} loading={list.isPending} canUpdate={canUpdate} />
          ) : (
            <LeadTable data={list.data} loading={list.isFetching} s={s} />
          )}
        </div>
        <aside className="min-w-0 xl:sticky xl:top-4">
          <FollowUpsPanel canUpdate={canUpdate} branchId={s.branchId || undefined} />
        </aside>
      </div>
    </div>
  );
}
