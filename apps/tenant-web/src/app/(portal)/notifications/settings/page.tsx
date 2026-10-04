'use client';

import * as React from 'react';
import Link from 'next/link';
import { AlertTriangle, Bell, CalendarCheck, CreditCard, Dumbbell, HeartHandshake, Lock, UserCheck } from 'lucide-react';
import { toast } from 'sonner';

import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { NotificationsHero } from '@/features/notifications/components/notifications-hero';
import { TemplateCard, type TemplateGroup } from '@/features/notifications/components/template-parts';
import { TemplateEditDialog } from '@/features/notifications/components/template-edit-dialog';
import { useNotificationTemplates, useUpdateNotificationTemplate } from '@/features/notifications/hooks/use-notifications';
import type { NotificationTemplate } from '@/features/notifications/types';
import { ChartCard, EmptyState, SkeletonBlock } from '@/features/reports/components/ui';
import { accentChipStyle } from '@/features/reports/lib/reports-theme';

const GROUPS: TemplateGroup[] = [
  { key: 'membership', label: 'Membership', description: 'Expiry reminders and renewals', accent: 'members', icon: UserCheck, types: ['MEMBERSHIP_EXPIRY', 'MEMBERSHIP_RENEWAL'] },
  { key: 'payments', label: 'Payments', description: 'Payment outcomes', accent: 'finance', icon: CreditCard, types: ['PAYMENT_SUCCESS', 'PAYMENT_FAILED'] },
  { key: 'attendance', label: 'Attendance', description: 'Check-in confirmations', accent: 'attendance', icon: CalendarCheck, types: ['ATTENDANCE_CONFIRMATION'] },
  { key: 'plans', label: 'Plans', description: 'Workout and diet assignments', accent: 'operations', icon: Dumbbell, types: ['WORKOUT_ASSIGNMENT', 'DIET_ASSIGNMENT'] },
  { key: 'engagement', label: 'Engagement', description: 'Welcome and goodwill messages', accent: 'staff', icon: HeartHandshake, types: ['NEW_MEMBER_REGISTRATION', 'WELCOME_MESSAGE', 'BIRTHDAY_WISHES'] },
];

export default function NotificationSettingsPage() {
  const { hasPermission } = usePermissions();
  const canManage = hasPermission('notifications:manage');
  // Gated: users without notifications:manage never fire the templates request (it would 403).
  const templates = useNotificationTemplates(canManage);
  const updateTemplate = useUpdateNotificationTemplate();
  const [editing, setEditing] = React.useState<NotificationTemplate | null>(null);
  const [togglingType, setTogglingType] = React.useState<string | null>(null);

  const list = React.useMemo(() => templates.data ?? [], [templates.data]);
  const byType = React.useMemo(() => new Map(list.map((t) => [t.type, t])), [list]);
  const stats = React.useMemo(
    () => ({
      active: list.filter((t) => t.isActive).length,
      customized: list.filter((t) => t.isCustomized).length,
      channels: new Set(list.filter((t) => t.isActive).flatMap((t) => t.channels)).size,
    }),
    [list],
  );
  // Templates the API returns that are not in any group (future types) still show up.
  const grouped = new Set(GROUPS.flatMap((g) => g.types));
  const extra = list.filter((t) => !grouped.has(t.type));

  if (!canManage) {
    return (
      <div className="mx-auto max-w-lg pt-10">
        <EmptyState
          icon={Lock}
          accent="staff"
          title="Notification settings are managed by admins"
          description="You don't have permission to manage notification templates. Ask your gym owner for the notifications:manage permission."
          action={
            <Link href="/notifications" className="inline-flex h-9 items-center rounded-lg border px-3 text-sm font-bold hover:bg-accent">
              Back to notifications
            </Link>
          }
        />
      </div>
    );
  }

  const toggleActive = (t: NotificationTemplate) => {
    setTogglingType(t.type);
    updateTemplate.mutate(
      { type: t.type, input: { channels: t.channels, titleTemplate: t.titleTemplate, bodyTemplate: t.bodyTemplate, isActive: !t.isActive } },
      {
        onSuccess: () => toast.success(t.isActive ? `${t.label} disabled.` : `${t.label} enabled.`),
        onError: () => toast.error('Could not update the template.'),
        onSettled: () => setTogglingType(null),
      },
    );
  };

  const renderCards = (items: NotificationTemplate[], accent: TemplateGroup['accent']) => (
    <div className="grid gap-3.5 md:grid-cols-2 xl:grid-cols-3">
      {items.map((t, i) => (
        <TemplateCard key={t.type} template={t} accent={accent} index={i} toggling={togglingType === t.type} onToggle={() => toggleActive(t)} onEdit={() => setEditing(t)} />
      ))}
    </div>
  );

  return (
    <div className="space-y-5">
      <NotificationsHero
        active="settings"
        eyebrow="Communication"
        title="Notification settings"
        subtitle="Customize the title, body and delivery channels of every automatic notification. Placeholders like {{memberName}} are filled in automatically."
        backHref="/notifications"
        backLabel="Back to notifications"
        statsLoading={templates.isPending}
        stats={templates.isError ? undefined : [
          { label: 'Templates active', value: stats.active },
          { label: 'Customized', value: stats.customized },
          { label: 'Channels in use', value: stats.channels },
        ]}
      />

      {templates.isPending ? (
        <div className="grid gap-3.5 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonBlock key={i} height={200} />
          ))}
        </div>
      ) : templates.isError ? (
        <EmptyState
          icon={AlertTriangle}
          accent="staff"
          title="Could not load templates"
          action={
            <button type="button" onClick={() => void templates.refetch()} className="rounded-lg border px-3 py-1.5 text-xs font-bold hover:bg-accent">
              Try again
            </button>
          }
        />
      ) : (
        <>
          {GROUPS.map((g) => {
            const items = g.types.map((t) => byType.get(t)).filter((t): t is NotificationTemplate => Boolean(t));
            if (!items.length) return null;
            return (
              <ChartCard
                key={g.key}
                title={
                  <span className="inline-flex items-center gap-2.5">
                    <span className="flex size-8 items-center justify-center rounded-lg" style={accentChipStyle(g.accent)}>
                      <g.icon className="size-4" aria-hidden />
                    </span>
                    {g.label}
                  </span>
                }
                subtitle={g.description}
              >
                {renderCards(items, g.accent)}
              </ChartCard>
            );
          })}
          {extra.length ? (
            <ChartCard title={<span className="inline-flex items-center gap-2"><Bell className="size-4" aria-hidden /> Other</span>}>{renderCards(extra, 'analytics')}</ChartCard>
          ) : null}
          {/* Push, SMS and WhatsApp are not delivered yet: shown as 'soon' chips on each card, disabled (PUSH/SMS) in the edit dialog. */}
        </>
      )}

      <TemplateEditDialog template={editing} onClose={() => setEditing(null)} />
    </div>
  );
}
