'use client';

import * as React from 'react';
import { CalendarClock, Megaphone, Plus, Send, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { cn } from '@/lib/utils';
import { AnnouncementStatusBadge } from '@/features/announcements/components/announcement-badges';
import { AnnouncementFormDialog } from '@/features/announcements/components/announcement-form-dialog';
import { ScheduleAnnouncementDialog } from '@/features/announcements/components/schedule-announcement-dialog';
import { toAnnouncementError, useAnnouncements, useDeleteAnnouncement, usePublishAnnouncement } from '@/features/announcements/hooks/use-announcements';
import type { AnnouncementStatus, TenantAnnouncement } from '@/features/announcements/types';

type FilterTab = 'ALL' | AnnouncementStatus;

const TABS: Array<{ value: FilterTab; label: string }> = [
  { value: 'ALL', label: 'All' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'SCHEDULED', label: 'Scheduled' },
  { value: 'PUBLISHED', label: 'Published' },
  { value: 'EXPIRED', label: 'Expired' },
];

export default function AnnouncementsPage() {
  const { hasPermission } = usePermissions();
  const canCreate = hasPermission('announcements:create');
  const canUpdate = hasPermission('announcements:update');
  const canDelete = hasPermission('announcements:delete');
  const canPublish = hasPermission('announcements:publish');

  const [tab, setTab] = React.useState<FilterTab>('ALL');
  const { data, isPending } = useAnnouncements(tab === 'ALL' ? {} : { status: tab });
  const publishAnnouncement = usePublishAnnouncement();
  const deleteAnnouncement = useDeleteAnnouncement();

  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<TenantAnnouncement | null>(null);
  const [scheduling, setScheduling] = React.useState<TenantAnnouncement | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = React.useState<string | null>(null);

  const items = data?.items ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3.5">
          <div
            className="flex size-10 shrink-0 items-center justify-center rounded-xl sm:size-11"
            style={{
              backgroundColor: 'color-mix(in oklch, var(--chart-3) 16%, transparent)',
              color: 'var(--chart-3)',
              boxShadow: '0 0 0 1px color-mix(in oklch, var(--chart-3) 18%, transparent)',
            }}
          >
            <Megaphone className="size-5" aria-hidden />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Announcements</h1>
            <p className="text-muted-foreground">Broadcast news to your members and staff.</p>
          </div>
        </div>
        {canCreate ? (
          <Button
            size="sm"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="size-4" /> New announcement
          </Button>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setTab(t.value)}
            className={cn(
              'rounded-full px-3 py-1 text-xs font-medium transition-colors duration-150',
              tab === t.value
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {isPending ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 w-full" />)
        ) : items.length === 0 ? (
          <EmptyState icon={Send} title="No announcements" description="Create one to broadcast news to your gym." />
        ) : (
          items.map((announcement) => (
            <div
              key={announcement.id}
              className="space-y-2 rounded-lg border border-border p-4 shadow-xs transition-shadow duration-150 hover:shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium">{announcement.title}</h3>
                    <AnnouncementStatusBadge status={announcement.status} />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {announcement.audience} · {announcement.branch?.name ?? 'All branches'} · by {announcement.createdBy.name}
                    {announcement.status === 'SCHEDULED' && announcement.publishAt ? ` · publishes ${new Date(announcement.publishAt).toLocaleString()}` : null}
                    {announcement.status === 'PUBLISHED' && announcement.publishedAt ? ` · published ${new Date(announcement.publishedAt).toLocaleString()}` : null}
                    {announcement.expiresAt ? ` · expires ${new Date(announcement.expiresAt).toLocaleDateString()}` : null}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {canUpdate && (announcement.status === 'DRAFT' || announcement.status === 'SCHEDULED') ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs"
                      onClick={() => {
                        setEditing(announcement);
                        setFormOpen(true);
                      }}
                    >
                      Edit
                    </Button>
                  ) : null}
                  {canPublish && (announcement.status === 'DRAFT' || announcement.status === 'SCHEDULED') ? (
                    <>
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setScheduling(announcement)}>
                        <CalendarClock className="size-3.5" /> Schedule
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-xs"
                        disabled={publishAnnouncement.isPending}
                        onClick={() =>
                          publishAnnouncement.mutate(announcement.id, {
                            onSuccess: () => toast.success('Announcement published.'),
                            onError: (err) => toast.error(toAnnouncementError(err).message),
                          })
                        }
                      >
                        <Send className="size-3.5" /> Publish now
                      </Button>
                    </>
                  ) : null}
                  {canDelete ? (
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-destructive" onClick={() => setConfirmDeleteId(announcement.id)}>
                      <Trash2 className="size-3.5" />
                    </Button>
                  ) : null}
                </div>
              </div>
              {/* Staff-authored rich text — same trust model as other internal-content HTML in this app (e.g. invoice email bodies). */}
              <div className="prose prose-sm max-w-none text-sm" dangerouslySetInnerHTML={{ __html: announcement.body }} />
            </div>
          ))
        )}
      </div>

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
