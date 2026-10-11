'use client';

import * as React from 'react';
import Link from 'next/link';
import { CalendarClock, Phone } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoadingButton } from '@/components/ui/loading-button';
import { PanelCard } from '@/features/finance/components/payments/payments-ui';
import { SegmentedTabs, EmptyState } from '@/features/reports/components/ui';
import { toLeadError, useAddLeadActivity, useFollowUps } from '../../hooks/use-leads';
import { formatDateTime, localInputToIso, telHref } from '../../lib/lead-meta';
import type { LeadListItem } from '../../types';
import { FollowUpBadge, LeadAvatar } from '../shared/lead-ui';

function Row({ lead, canUpdate }: { lead: LeadListItem; canUpdate: boolean }) {
  const add = useAddLeadActivity();
  const [resched, setResched] = React.useState(false);
  const [when, setWhen] = React.useState('');
  const act = (payload: Parameters<typeof add.mutate>[0]['payload'], msg: string) =>
    add.mutate({ id: lead.id, payload }, { onSuccess: () => { toast.success(msg); setResched(false); }, onError: (e) => toast.error(toLeadError(e).message) });
  return (
    <li className="rounded-xl border bg-card p-3">
      <div className="flex items-center gap-2.5">
        <LeadAvatar name={lead.name} size={30} />
        <div className="min-w-0 flex-1">
          <Link href={`/leads/${lead.id}`} className="block truncate text-sm font-bold hover:underline">{lead.name}</Link>
          <span className="text-xs text-muted-foreground">{formatDateTime(lead.nextFollowUpAt)}</span>
        </div>
        <FollowUpBadge state={lead.followUpState} at={lead.nextFollowUpAt} />
      </div>
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        <a href={telHref(lead.phone)} className="inline-flex h-8 items-center gap-1 rounded-lg border px-2.5 text-xs font-semibold hover:bg-accent"><Phone className="size-3" aria-hidden />Dial</a>
        {canUpdate ? (
          <>
            <LoadingButton size="sm" variant="outline" className="h-8 px-2.5 text-xs" loading={add.isPending && !resched} onClick={() => act({ type: 'CALL', note: 'Follow-up call logged' }, 'Call logged.')}>Log call</LoadingButton>
            <Button size="sm" variant="outline" className="h-8 px-2.5 text-xs" onClick={() => setResched((v) => !v)} aria-expanded={resched}>Reschedule</Button>
          </>
        ) : null}
        <Link href={`/leads/${lead.id}`} className="inline-flex h-8 items-center rounded-lg px-2.5 text-xs font-semibold text-primary hover:underline">Open</Link>
      </div>
      {resched ? (
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <Input type="datetime-local" aria-label="New follow-up time" className="h-9 w-auto min-w-0 flex-1" value={when} onChange={(e) => setWhen(e.target.value)} />
          <LoadingButton size="sm" loading={add.isPending} disabled={!when} onClick={() => act({ type: 'FOLLOW_UP', note: 'Follow-up rescheduled', nextFollowUpAt: localInputToIso(when) }, 'Follow-up rescheduled.')}>Save</LoadingButton>
        </div>
      ) : null}
    </li>
  );
}

/** Today + overdue follow-ups with quick actions. Scope "mine" by default; "all" for the whole team. */
export function FollowUpsPanel({ canUpdate, branchId }: { canUpdate: boolean; branchId?: string }) {
  const [scope, setScope] = React.useState<'mine' | 'all'>('all');
  const q = useFollowUps('due', scope, branchId);
  const c = q.data?.counts;
  return (
    <PanelCard
      title="Follow-ups"
      subtitle={c ? `${c.overdue} overdue, ${c.today} due today, ${c.upcoming} upcoming` : 'Due today and overdue'}
      loading={q.isPending}
      error={q.isError}
      skeletonHeight={220}
      action={<SegmentedTabs size="sm" ariaLabel="Follow-up scope" value={scope} onChange={setScope} options={[{ value: 'all', label: 'Team' }, { value: 'mine', label: 'Mine' }]} />}
    >
      {q.data && q.data.items.length ? (
        <ul className="max-h-[560px] space-y-2.5 overflow-y-auto pr-0.5">
          {q.data.items.map((l) => <Row key={l.id} lead={l} canUpdate={canUpdate} />)}
        </ul>
      ) : (
        <EmptyState compact icon={CalendarClock} title="Nothing due" description="No overdue or due-today follow-ups. Nice." />
      )}
    </PanelCard>
  );
}
