'use client';

import { LifeBuoy, Mail, Plus } from 'lucide-react';
import * as React from 'react';

import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { HeroButton } from '@/features/finance/components/payments/payments-hero';
import { AnnouncementsPeriodBar } from '@/features/announcements/components/announcements-period-bar';
import { useAnnouncementPeriod } from '@/features/announcements/lib/use-announcement-period';
import { EmptyState } from '@/features/reports/components/ui';
import { HelpCentre } from '@/features/support/components/help-centre';
import { NewTicketDialog } from '@/features/support/components/new-ticket-dialog';
import { SupportHero } from '@/features/support/components/support-hero';
import { SupportInsights } from '@/features/support/components/support-insights';
import { TicketDetailDialog } from '@/features/support/components/ticket-detail-dialog';
import { TicketList } from '@/features/support/components/ticket-list';
import { useTicketStats } from '@/features/support/hooks/use-tickets';
import { useTenant } from '@/features/tenant/tenant-provider';

/** Support: hero + period/analytics (stats API) + help centre + tickets. Plan gating (`support_tickets`) and `support:view`/`support:create` unchanged. */
export default function SupportPage() {
  const tenant = useTenant();
  const { hasPermission } = usePermissions();
  const hasTickets = tenant.featureFlags.includes('support_tickets');
  const canView = hasPermission('support:view');
  const canCreate = hasPermission('support:create');
  const ticketsEnabled = hasTickets && canView;

  const controls = useAnnouncementPeriod('month');
  const statsQuery = useTicketStats(controls.params, ticketsEnabled && controls.rangeReady);
  // Analytics are optional: a failing stats call (or no view permission/plan) hides the section and hero stats; the list keeps working.
  const showInsights = ticketsEnabled && !statsQuery.isError;
  const stats = statsQuery.data;
  const statsLoading = statsQuery.isPending && statsQuery.fetchStatus !== 'idle';

  const [newOpen, setNewOpen] = React.useState(false);
  const [selectedTicketId, setSelectedTicketId] = React.useState<string | null>(null);
  const canRaise = hasTickets && canCreate;

  return (
    <div className="space-y-5">
      <SupportHero
        stats={
          showInsights
            ? [
                { label: 'Open', value: stats?.kpis.open.value ?? 0 },
                { label: 'In progress', value: stats?.kpis.inProgress.value ?? 0 },
                { label: 'Resolved', value: stats?.kpis.resolved.value ?? 0 },
              ]
            : undefined
        }
        statsLoading={statsLoading && !stats}
        actions={
          <>
            {canRaise ? (
              <HeroButton solid onClick={() => setNewOpen(true)}>
                <Plus className="size-4" aria-hidden /> New ticket
              </HeroButton>
            ) : null}
            <HeroButton href="mailto:support@fitcloud.com">
              <Mail className="size-4" aria-hidden /> Contact us
            </HeroButton>
          </>
        }
      />

      {showInsights ? (
        <>
          <AnnouncementsPeriodBar
            period={controls.period}
            onPeriod={controls.changePeriod}
            customFrom={controls.custom.from}
            customTo={controls.custom.to}
            onCustom={controls.setDates}
            compare={controls.compare}
            onCompare={controls.setCompare}
          />
          <SupportInsights stats={stats} loading={statsLoading && !stats} compare={controls.compare} previousLabel={controls.period === 'month' ? 'Last month' : 'Previous period'} />
        </>
      ) : null}

      <HelpCentre />

      {!hasTickets ? (
        <EmptyState icon={LifeBuoy} title="Not on your plan" description="Upgrade your subscription to unlock support tickets." />
      ) : !canView ? (
        <EmptyState icon={LifeBuoy} title="No access" description="You don't have permission to view support tickets." />
      ) : (
        <TicketList enabled={ticketsEnabled} onView={setSelectedTicketId} onCreate={canRaise ? () => setNewOpen(true) : undefined} />
      )}

      {canRaise ? <NewTicketDialog open={newOpen} onOpenChange={setNewOpen} /> : null}
      <TicketDetailDialog ticketId={selectedTicketId} onOpenChange={(open) => !open && setSelectedTicketId(null)} />
    </div>
  );
}
