'use client';

import * as React from 'react';
import Link from 'next/link';
import { Phone, UserRound } from 'lucide-react';

import { cn } from '@/lib/utils';
import { STATUS_META, telHref } from '../../lib/lead-meta';
import type { LeadListItem } from '../../types';
import { AgeText, FollowUpBadge, LeadAvatar, SourceChip } from '../shared/lead-ui';
import { StageControl } from '../shared/stage-control';

/** Kanban card: identity, source, plan, assignee, follow-up + age, inline stage control. */
export function LeadCard({ lead, canUpdate }: { lead: LeadListItem; canUpdate: boolean }) {
  const meta = STATUS_META[lead.status];
  return (
    <article className={cn('rounded-xl border bg-card p-3 shadow-xs transition-shadow hover:shadow-md')} style={{ borderLeft: `3px solid ${meta.color}` }}>
      <div className="flex items-start gap-2.5">
        <LeadAvatar name={lead.name} size={32} />
        <div className="min-w-0 flex-1">
          <Link href={`/leads/${lead.id}`} className="block truncate text-sm font-bold hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            {lead.name}
          </Link>
          <a href={telHref(lead.phone)} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <Phone className="size-3" aria-hidden /> {lead.phone}
          </a>
        </div>
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <SourceChip source={lead.source} />
        {lead.interestedPlan ? <span className="max-w-full truncate rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold">{lead.interestedPlan.name}</span> : null}
        <FollowUpBadge state={lead.followUpState} at={lead.nextFollowUpAt} />
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
        <span className="inline-flex min-w-0 items-center gap-1">
          <UserRound className="size-3 shrink-0" aria-hidden />
          <span className="truncate">{lead.assignedTo?.name ?? 'Unassigned'}</span>
        </span>
        <AgeText createdAt={lead.createdAt} />
      </div>
      {lead.status === 'LOST' && lead.lostReason ? <p className="mt-1.5 text-[11px] font-semibold text-destructive">Lost: {lead.lostReason.replace(/_/g, ' ').toLowerCase()}</p> : null}
      {canUpdate && lead.status !== 'CONVERTED' ? (
        <div className="mt-2.5">
          <StageControl leadId={lead.id} status={lead.status} />
        </div>
      ) : null}
    </article>
  );
}
