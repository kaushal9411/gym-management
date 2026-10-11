'use client';

import * as React from 'react';
import { Search, X } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Chip } from '@/features/finance/components/payments/payments-ui';
import { useAssignablePlans } from '@/features/members/hooks/use-members';
import type { LeadsPageState } from '../../hooks/use-leads-page-state';
import { useLeadAssignees } from '../../hooks/use-leads';
import { FOLLOW_UP_LABEL, SOURCE_META, STATUS_META } from '../../lib/lead-meta';
import { LEAD_SOURCES, LEAD_STATUSES, type FollowUpState, type LeadCounts } from '../../types';
import { FieldLabel } from '../shared/lead-ui';

export function FilterBar({ s, counts }: { s: LeadsPageState; counts: LeadCounts | undefined }) {
  const assignees = useLeadAssignees();
  const plans = useAssignablePlans();
  return (
    <section aria-label="Lead filters" className="space-y-3 rounded-[20px] border bg-card p-4 shadow-xs">
      <div className="flex flex-wrap items-center gap-1.5">
        <Chip small active={!s.status} onClick={() => s.set({ status: null })}>
          All {counts ? <b className="tabular-nums">{counts.all}</b> : null}
        </Chip>
        {LEAD_STATUSES.map((st) => (
          <Chip key={st} small active={s.status === st} dotColor={STATUS_META[st].color} onClick={() => s.set({ status: s.status === st ? null : st })}>
            {STATUS_META[st].label} {counts ? <b className="tabular-nums">{counts[st]}</b> : null}
          </Chip>
        ))}
      </div>
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <div className="relative col-span-2">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input aria-label="Search leads" value={s.search} onChange={(e) => s.setSearch(e.target.value)} placeholder="Search name, phone, email" className="pl-9" />
        </div>
        <Select aria-label="Source" value={s.source} onChange={(e) => s.set({ source: e.target.value })}>
          <option value="">All sources</option>
          {LEAD_SOURCES.map((x) => (
            <option key={x} value={x}>{SOURCE_META[x].label}</option>
          ))}
        </Select>
        <Select aria-label="Assignee" value={s.assignee} onChange={(e) => s.set({ assignee: e.target.value })}>
          <option value="">Anyone</option>
          <option value="me">Assigned to me</option>
          <option value="unassigned">Unassigned</option>
          {(assignees.data ?? []).map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </Select>
        <Select aria-label="Interested plan" value={s.plan} onChange={(e) => s.set({ plan: e.target.value })}>
          <option value="">Any plan</option>
          {(plans.data ?? []).map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </Select>
        <Select aria-label="Follow-up" value={s.followUp} onChange={(e) => s.set({ fu: e.target.value })}>
          <option value="">Any follow-up</option>
          {(['overdue', 'today', 'upcoming', 'none'] as FollowUpState[]).map((f) => (
            <option key={f} value={f}>{FOLLOW_UP_LABEL[f]}</option>
          ))}
        </Select>
        <div className="flex items-center gap-1.5 col-span-2">
          <FieldLabel>Created</FieldLabel>
          <Input type="date" aria-label="Created from" value={s.createdFrom} max={s.createdTo || undefined} onChange={(e) => s.set({ from: e.target.value })} className="min-w-0" />
          <span className="text-muted-foreground">-</span>
          <Input type="date" aria-label="Created to" value={s.createdTo} min={s.createdFrom || undefined} onChange={(e) => s.set({ to: e.target.value })} className="min-w-0" />
        </div>
      </div>
      {s.activeFilterCount > 0 ? (
        <button type="button" onClick={s.clearFilters} className="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-bold hover:bg-accent">
          <X className="size-3" aria-hidden /> Clear {s.activeFilterCount} filter{s.activeFilterCount > 1 ? 's' : ''}
        </button>
      ) : null}
    </section>
  );
}
