'use client';

import * as React from 'react';
import Link from 'next/link';
import { CalendarDays, Contact, Mail, Megaphone, Phone, Sparkles, StickyNote, Target } from 'lucide-react';

import { PanelCard } from '@/features/members/components/detail/detail-ui';
import { formatDateTime, formatDay, lostReasonLabel, telHref } from '../../lib/lead-meta';
import type { LeadDetail } from '../../types';
import { FollowUpBadge, SourceChip } from '../shared/lead-ui';

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words text-right font-medium">{children}</dd>
    </div>
  );
}
const dash = <span className="text-muted-foreground">-</span>;

export function DetailSidePanels({ lead }: { lead: LeadDetail }) {
  return (
    <div className="space-y-4">
      <PanelCard icon={Contact} accent="primary" title="Contact" delay={0.05}>
        <dl className="space-y-2.5">
          <Row label="Phone"><a href={telHref(lead.phone)} className="inline-flex items-center gap-1 hover:underline"><Phone className="size-3.5" aria-hidden />{lead.phone}</a></Row>
          <Row label="Email">{lead.email ? <a href={`mailto:${lead.email}`} className="inline-flex items-center gap-1 break-all hover:underline"><Mail className="size-3.5 shrink-0" aria-hidden />{lead.email}</a> : dash}</Row>
          <Row label="Branch">{lead.branch?.name ?? dash}</Row>
        </dl>
      </PanelCard>
      <PanelCard icon={Target} accent="violet" title="Interest & plan" delay={0.1}>
        <dl className="space-y-2.5">
          <Row label="Interested plan">{lead.interestedPlan?.name ?? dash}</Row>
          <Row label="Goal / interest">{lead.interest ?? dash}</Row>
          <Row label="Expected join">{lead.expectedJoinDate ? formatDay(lead.expectedJoinDate) : dash}</Row>
        </dl>
      </PanelCard>
      <PanelCard icon={Megaphone} accent="aqua" title="Source" delay={0.15}>
        <dl className="space-y-2.5">
          <Row label="Channel"><SourceChip source={lead.source} /></Row>
          <Row label="Detail">{lead.sourceDetail ?? dash}</Row>
        </dl>
      </PanelCard>
      <PanelCard icon={StickyNote} accent="warning" title="Notes" delay={0.2}>
        {lead.notes ? <p className="whitespace-pre-wrap break-words text-sm">{lead.notes}</p> : <p className="text-sm text-muted-foreground">No notes.</p>}
      </PanelCard>
      {lead.status === 'CONVERTED' || lead.status === 'LOST' ? (
        <PanelCard icon={Sparkles} accent={lead.status === 'CONVERTED' ? 'success' : 'destructive'} title={lead.status === 'CONVERTED' ? 'Conversion' : 'Lost'} delay={0.25}>
          {lead.status === 'CONVERTED' ? (
            <dl className="space-y-2.5">
              <Row label="Converted on">{formatDay(lead.convertedAt)}</Row>
              <Row label="Member">{lead.convertedMember ? <Link href={`/members/${lead.convertedMember.id}`} className="font-bold text-primary hover:underline">{lead.convertedMember.name} ({lead.convertedMember.memberId})</Link> : <span className="text-muted-foreground">Not linked to a member record</span>}</Row>
            </dl>
          ) : (
            <dl className="space-y-2.5">
              <Row label="Reason">{lead.lostReason ? lostReasonLabel(lead.lostReason) : dash}</Row>
              <Row label="Note">{lead.lostNote ?? dash}</Row>
              <Row label="Lost on">{formatDay(lead.lostAt)}</Row>
            </dl>
          )}
        </PanelCard>
      ) : null}
      <PanelCard icon={CalendarDays} accent="primary" title="Key dates" delay={0.3}>
        <dl className="space-y-2.5">
          <Row label="Next follow-up">{lead.nextFollowUpAt ? <span className="inline-flex flex-wrap items-center justify-end gap-1.5">{formatDateTime(lead.nextFollowUpAt)} <FollowUpBadge state={lead.followUpState} at={lead.nextFollowUpAt} /></span> : dash}</Row>
          <Row label="Last activity">{formatDateTime(lead.lastActivityAt)}</Row>
          <Row label="Created">{formatDateTime(lead.createdAt)}{lead.createdBy ? ` by ${lead.createdBy.name}` : ''}</Row>
          <Row label="Updated">{formatDateTime(lead.updatedAt)}</Row>
        </dl>
      </PanelCard>
    </div>
  );
}
