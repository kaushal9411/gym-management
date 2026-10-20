'use client';

import * as React from 'react';
import { MoonStar, Zap } from 'lucide-react';
import { toast } from 'sonner';

import { Skeleton } from '@/components/ui/skeleton';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { EmptyState } from '@/features/reports/components/ui';
import { COMMUNICATIONS_PERMISSIONS } from '../../constants';
import { useAutomations, useUpdateAutomation } from '../../hooks/use-communications';
import { classifyError, describeLoadError } from '../../lib/errors';
import type { AutomationKey, AutomationRule } from '../../types';
import { Banner } from '../common';
import { RuleCard } from './rule-card';
import { RuleEditor } from './rule-editor';

/** Automations tab: nine built-in reminder rules as cards with live switches; the editor opens in a side sheet. */
export function AutomationsPage() {
  const { hasPermission } = usePermissions();
  const canManage = hasPermission(COMMUNICATIONS_PERMISSIONS.manage);
  const q = useAutomations();
  const update = useUpdateAutomation();
  const [editingKey, setEditingKey] = React.useState<AutomationKey | null>(null);
  const [togglingKey, setTogglingKey] = React.useState<AutomationKey | null>(null);

  const rules = q.data?.items ?? [];
  const editing = rules.find((r) => r.key === editingKey) ?? null;

  const toggle = (rule: AutomationRule, next: boolean) => {
    setTogglingKey(rule.key);
    update.mutate(
      {
        key: rule.key,
        input: {
          enabled: next,
          channels: rule.channels,
          ...(rule.timing.editable ? { offsets: rule.offsets } : {}),
          title: rule.title,
          body: rule.body,
        },
      },
      {
        onSuccess: () => toast.success(`${rule.label} is now ${next ? 'on' : 'off'}.`),
        onError: (err) => {
          const e = classifyError(err);
          toast.error(Object.values(e.fieldErrors)[0] ?? e.message);
        },
        onSettled: () => setTogglingKey(null),
      },
    );
  };

  if (q.isLoading) {
    return (
      <div className="grid gap-3.5 sm:grid-cols-[repeat(auto-fill,minmax(270px,1fr))]" aria-busy aria-label="Loading automations">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-40 rounded-2xl" />
        ))}
      </div>
    );
  }
  if (q.isError) {
    return (
      <Banner title="Couldn't load automations" action={{ label: 'Try again', onClick: () => void q.refetch(), busy: q.isFetching }}>
        {describeLoadError(q.error, 'your automations')}
      </Banner>
    );
  }
  if (rules.length === 0) {
    return <EmptyState icon={Zap} title="No automations available" description="Reminder rules will appear here once your gym has them set up." />;
  }

  return (
    <div className="space-y-4">
      <p className="flex items-start gap-2 text-[13px] text-muted-foreground">
        <MoonStar className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>
          Reminders run on their own. SMS and WhatsApp ones pause between {q.data?.quietHours.start ?? '21:00'} and {q.data?.quietHours.end ?? '08:00'} in each member&apos;s branch time zone.
          {canManage ? '' : ' You can view these rules; changing them needs the Manage notifications permission.'}
        </span>
      </p>
      <div className="grid gap-3.5 sm:grid-cols-[repeat(auto-fill,minmax(270px,1fr))]">
        {rules.map((r) => (
          <RuleCard key={r.key} rule={r} canManage={canManage} toggling={togglingKey === r.key} onToggle={(v) => toggle(r, v)} onEdit={() => setEditingKey(r.key)} />
        ))}
      </div>
      <RuleEditor rule={editing} canManage={canManage} onClose={() => setEditingKey(null)} />
    </div>
  );
}
