'use client';

import { Plus } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';

import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { HeroButton } from '@/features/finance/components/payments/payments-hero';
import { AnnouncementFormDialog } from '@/features/announcements/components/announcement-form-dialog';
import { AnnouncementInsights } from '@/features/announcements/components/insights/announcement-insights';
import { AnnouncementList } from '@/features/announcements/components/announcement-list';
import { AnnouncementsHero } from '@/features/announcements/components/announcements-hero';
import { AnnouncementsPeriodBar } from '@/features/announcements/components/announcements-period-bar';
import { ScheduleAnnouncementDialog } from '@/features/announcements/components/schedule-announcement-dialog';
import { useAnnouncementStats, useDeleteAnnouncement } from '@/features/announcements/hooks/use-announcements';
import { useAnnouncementPeriod } from '@/features/announcements/lib/use-announcement-period';
import type { TenantAnnouncement } from '@/features/announcements/types';

export default function AnnouncementsPage() {
  const { hasPermission } = usePermissions();
  const canView = hasPermission('announcements:view');
  const canCreate = hasPermission('announcements:create');
  const canUpdate = hasPermission('announcements:update');
  const canDelete = hasPermission('announcements:delete');
  const canPublish = hasPermission('announcements:publish');

  const controls = useAnnouncementPeriod('month');
  const statsQuery = useAnnouncementStats(controls.params, canView && controls.rangeReady);
  // Analytics are optional: when the stats call fails (or the user lacks view) the section and hero stats are hidden, the list keeps working.
  const showInsights = canView && !statsQuery.isError;
  const stats = statsQuery.data;
  const statsLoading = statsQuery.isPending && statsQuery.fetchStatus !== 'idle';

  const deleteAnnouncement = useDeleteAnnouncement();
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<TenantAnnouncement | null>(null);
  const [scheduling, setScheduling] = React.useState<TenantAnnouncement | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = React.useState<string | null>(null);

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  return (
    <div className="space-y-5">
      <AnnouncementsHero
        stats={
          showInsights
            ? [
                { label: 'Published this period', value: stats?.kpis.published.value ?? 0 },
                { label: 'Scheduled', value: stats?.kpis.scheduled.value ?? 0 },
                { label: 'Drafts', value: stats?.kpis.drafts.value ?? 0 },
              ]
            : undefined
        }
        statsLoading={statsLoading && !stats}
        actions={
          canCreate ? (
            <HeroButton solid onClick={openCreate}>
              <Plus className="size-4" aria-hidden /> New announcement
            </HeroButton>
          ) : null
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
          <AnnouncementInsights stats={stats} loading={statsLoading && !stats} compare={controls.compare} previousLabel={controls.period === 'month' ? 'Last month' : 'Previous period'} />
        </>
      ) : null}

      <AnnouncementList
        onCreate={canCreate ? openCreate : undefined}
        actions={{
          canUpdate,
          canPublish,
          canDelete,
          onEdit: (a) => {
            setEditing(a);
            setFormOpen(true);
          },
          onSchedule: setScheduling,
          onDelete: (a) => setConfirmDeleteId(a.id),
        }}
      />

      <AnnouncementFormDialog open={formOpen} onOpenChange={setFormOpen} editing={editing} />
      <ScheduleAnnouncementDialog announcement={scheduling} onOpenChange={(open) => !open && setScheduling(null)} />

      <ConfirmDialog
        open={confirmDeleteId !== null}
        onOpenChange={(open) => !open && setConfirmDeleteId(null)}
        title="Delete this announcement?"
        description="This action can't be undone."
        destructive
        loading={deleteAnnouncement.isPending}
        onConfirm={() => {
          if (confirmDeleteId) deleteAnnouncement.mutate(confirmDeleteId, { onSuccess: () => toast.success('Announcement deleted.') });
          setConfirmDeleteId(null);
        }}
      />
    </div>
  );
}
