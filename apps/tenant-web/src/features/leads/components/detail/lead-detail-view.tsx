'use client';

import * as React from 'react';
import Link from 'next/link';
import { AlertTriangle, CalendarClock, Mail, MessageCircle, Pencil, Phone, RotateCcw, Trash2, UserCheck, UserPlus, UserRound, XCircle } from 'lucide-react';
import { toast } from 'sonner';

import { Skeleton } from '@/components/ui/skeleton';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { HeroButton, PaymentsHero } from '@/features/finance/components/payments/payments-hero';
import { PanelCard } from '@/features/finance/components/payments/payments-ui';
import { EmptyState } from '@/features/reports/components/ui';
import { PanelCard as AccentCard } from '@/features/members/components/detail/detail-ui';
import { LeadError, toLeadError, useChangeLeadStatus, useLeadDetail } from '../../hooks/use-leads';
import { ageLabel, telHref, whatsappHref } from '../../lib/lead-meta';
import { OPEN_STATUSES, type LeadDetail } from '../../types';
import { FollowUpBadge, SourceChip, StatusPill } from '../shared/lead-ui';
import { ActivityComposer } from './activity-composer';
import { ActivityTimeline } from './activity-timeline';
import { DetailActionPanel, type ActionPanel } from './detail-actions';
import { DetailSidePanels } from './side-panels';
import { StatusStepper } from './status-stepper';
import { History } from 'lucide-react';

function reachedIndex(lead: LeadDetail): number {
  let idx = 0;
  for (const a of lead.activities) {
    for (const st of [a.toStatus, a.fromStatus]) {
      const i = st ? OPEN_STATUSES.indexOf(st as (typeof OPEN_STATUSES)[number]) : -1;
      if (i > idx) idx = i;
    }
  }
  return idx;
}

function Loading() {
  return (
    <div className="space-y-3.5" aria-busy="true">
      <Skeleton className="h-[190px] rounded-[28px]" />
      <Skeleton className="h-[90px] rounded-[20px]" />
      <div className="grid gap-3.5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Skeleton className="h-[420px] rounded-2xl" />
        <Skeleton className="h-[420px] rounded-2xl" />
      </div>
    </div>
  );
}

export function LeadDetailView({ leadId }: { leadId: string }) {
  const { hasPermission } = usePermissions();
  const q = useLeadDetail(leadId);
  const status = useChangeLeadStatus();
  const [panel, setPanel] = React.useState<ActionPanel>(null);
  const toggle = (p: Exclude<ActionPanel, null>) => setPanel((cur) => (cur === p ? null : p));

  if (q.isPending) return <Loading />;
  if (q.isError || !q.data) {
    const notFound = q.error instanceof LeadError && q.error.notFound;
    return (
      <div className="mx-auto max-w-xl pt-10">
        <EmptyState
          icon={AlertTriangle}
          title={notFound ? 'Lead not found' : 'Could not load this lead'}
          description={notFound ? 'It may have been deleted, or it belongs to another branch.' : 'Please check your connection and try again.'}
          action={<Link href="/leads" className="inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground">Back to leads</Link>}
        />
      </div>
    );
  }

  const lead = q.data;
  const open = (OPEN_STATUSES as readonly string[]).includes(lead.status);
  const can = (k: string) => hasPermission(`leads:${k}`);
  const reopen = () =>
    status.mutate({ id: lead.id, payload: { status: 'NEW' } }, { onSuccess: () => toast.success('Lead reopened as New.'), onError: (e) => toast.error(toLeadError(e).message) });

  return (
    <div className="space-y-3.5">
      <PaymentsHero
        eyebrow="Lead"
        backHref="/leads"
        backLabel="Back to leads"
        title={lead.name}
        titleAdornment={<span className="rounded-full bg-white/95 p-0.5"><StatusPill status={lead.status} /></span>}
        subtitle={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <a href={telHref(lead.phone)} className="inline-flex items-center gap-1.5 font-semibold hover:underline"><Phone className="size-4" aria-hidden />{lead.phone}</a>
            {lead.email ? <a href={`mailto:${lead.email}`} className="inline-flex items-center gap-1.5 hover:underline"><Mail className="size-4" aria-hidden />{lead.email}</a> : null}
            <span className="rounded-full bg-white/95 text-foreground"><SourceChip source={lead.source} className="border-0 bg-transparent" /></span>
            <span className="inline-flex items-center gap-1.5"><UserRound className="size-4" aria-hidden />{lead.assignedTo?.name ?? 'Unassigned'}</span>
            <span className="inline-flex items-center gap-1.5"><CalendarClock className="size-4" aria-hidden />{ageLabel(lead.createdAt)} old</span>
            <span className="rounded-full bg-white/95"><FollowUpBadge state={lead.followUpState} at={lead.nextFollowUpAt} showTime /></span>
          </span>
        }
        actions={
          <>
            <HeroButton href={telHref(lead.phone)}><Phone className="size-4" aria-hidden />Call</HeroButton>
            <a href={whatsappHref(lead.phone)} target="_blank" rel="noreferrer" className="inline-flex h-11 items-center gap-2 whitespace-nowrap rounded-xl border border-white/30 bg-white/15 px-[18px] text-sm font-bold text-white hover:bg-white/25">
              <MessageCircle className="size-4" aria-hidden />WhatsApp
            </a>
            {can('update') ? <HeroButton onClick={() => toggle('edit')} aria-expanded={panel === 'edit'}><Pencil className="size-4" aria-hidden />Edit</HeroButton> : null}
            {can('assign') ? <HeroButton onClick={() => toggle('assign')} aria-expanded={panel === 'assign'}><UserPlus className="size-4" aria-hidden />Assign</HeroButton> : null}
            {can('update') && lead.status === 'LOST' ? <HeroButton onClick={reopen} disabled={status.isPending}><RotateCcw className="size-4" aria-hidden />Reopen</HeroButton> : null}
            {can('update') && open ? <HeroButton onClick={() => toggle('lost')} aria-expanded={panel === 'lost'}><XCircle className="size-4" aria-hidden />Mark lost</HeroButton> : null}
            {can('delete') ? <HeroButton onClick={() => toggle('delete')} aria-expanded={panel === 'delete'}><Trash2 className="size-4" aria-hidden />Delete</HeroButton> : null}
            {can('convert') && lead.status !== 'CONVERTED' ? <HeroButton solid onClick={() => toggle('convert')} aria-expanded={panel === 'convert'}><UserCheck className="size-4" aria-hidden />Convert to member</HeroButton> : null}
          </>
        }
      />

      <DetailActionPanel lead={lead} panel={panel} onClose={() => setPanel(null)} />

      <PanelCard title="Pipeline progress" subtitle={lead.status === 'LOST' ? 'Lost - reopen to continue.' : lead.status === 'CONVERTED' ? 'Joined as a member.' : 'Where this lead is in the funnel.'}>
        <StatusStepper status={lead.status} reachedIndex={reachedIndex(lead)} />
      </PanelCard>

      <div className="grid items-start gap-3.5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <AccentCard icon={History} accent="primary" title="Activity" right={<span className="text-xs text-muted-foreground">{lead.activities.length} events</span>}>
          {can('update') ? <ActivityComposer leadId={lead.id} closed={!open} /> : null}
          <ActivityTimeline activities={lead.activities} />
        </AccentCard>
        <DetailSidePanels lead={lead} />
      </div>
    </div>
  );
}
