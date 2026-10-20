'use client';

import * as React from 'react';

import { useBranches } from '@/features/branch/hooks/use-branches';
import { useAssignablePlans } from '@/features/members/hooks/use-members';
import { MAX_FILTER_DAYS_EXPIRING, MAX_NOT_VISITED_DAYS } from '../../constants';
import type { AudienceFilter, MembershipStatusFilter } from '../../types';
import { BoundedNumberInput, Chip, ChipGroup } from './chip';

const MEMBERSHIP_OPTIONS: Array<{ value: MembershipStatusFilter; label: string }> = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'EXPIRING', label: 'Expiring soon' },
  { value: 'EXPIRED', label: 'Expired' },
  { value: 'FROZEN', label: 'Frozen' },
  { value: 'NO_PLAN', label: 'No plan yet' },
];

function toggleId(list: string[] | undefined, id: string): string[] | undefined {
  const next = list?.includes(id) ? list.filter((x) => x !== id) : [...(list ?? []), id];
  return next.length ? next : undefined;
}

/** Step 1, "By filters": chips combine with AND (each one narrows the audience), exactly as the API's `audienceFilter`. */
export function AudienceFilters({ filter, onChange }: { filter: AudienceFilter; onChange: (patch: Partial<AudienceFilter>) => void }) {
  // Plans / branches are decorative filters: if the viewer cannot read them (403) the group simply stays hidden.
  const plans = useAssignablePlans();
  const branches = useBranches();
  const activeBranches = (branches.data ?? []).filter((b) => b.isActive);

  return (
    <div>
      <ChipGroup label="Membership">
        {MEMBERSHIP_OPTIONS.map((o) => (
          <Chip
            key={o.value}
            pressed={filter.membershipStatus === o.value}
            onClick={() => onChange({ membershipStatus: filter.membershipStatus === o.value ? undefined : o.value, expiringWithinDays: o.value === 'EXPIRING' ? 7 : undefined })}
          >
            {o.value === 'EXPIRING' ? `Expiring in ${filter.membershipStatus === 'EXPIRING' ? (filter.expiringWithinDays ?? 7) : 7} days` : o.label}
          </Chip>
        ))}
        {filter.membershipStatus === 'EXPIRING' ? (
          <div className="basis-full">
            <BoundedNumberInput
              id="cm-expiring-days"
              label="Ends within"
              suffix="days"
              min={1}
              max={MAX_FILTER_DAYS_EXPIRING}
              value={filter.expiringWithinDays ?? 7}
              onCommit={(n) => onChange({ expiringWithinDays: n })}
            />
          </div>
        ) : null}
      </ChipGroup>

      {plans.data && plans.data.length > 0 ? (
        <ChipGroup label="Plan" hint={filter.planIds && filter.planIds.length > 1 ? 'Members on any of the selected plans.' : undefined}>
          {plans.data.slice(0, 50).map((p) => (
            <Chip key={p.id} pressed={!!filter.planIds?.includes(p.id)} onClick={() => onChange({ planIds: toggleId(filter.planIds, p.id) })}>
              {p.name}
            </Chip>
          ))}
        </ChipGroup>
      ) : null}

      {activeBranches.length > 1 ? (
        <ChipGroup label="Branch">
          {activeBranches.slice(0, 50).map((b) => (
            <Chip key={b.id} pressed={!!filter.branchIds?.includes(b.id)} onClick={() => onChange({ branchIds: toggleId(filter.branchIds, b.id) })}>
              {b.name}
            </Chip>
          ))}
        </ChipGroup>
      ) : null}

      <ChipGroup label="Payment and activity">
        <Chip pressed={!!filter.hasOverdueInvoice} onClick={() => onChange({ hasOverdueInvoice: !filter.hasOverdueInvoice || undefined })}>
          Has overdue invoice
        </Chip>
        <Chip pressed={!!filter.hasUnpaidInvoice} onClick={() => onChange({ hasUnpaidInvoice: !filter.hasUnpaidInvoice || undefined })}>
          Has unpaid invoice
        </Chip>
        <Chip pressed={!!filter.notVisitedDays} onClick={() => onChange({ notVisitedDays: filter.notVisitedDays ? undefined : 14 })}>
          Not visited in {filter.notVisitedDays ?? 14} days
        </Chip>
        <Chip pressed={!!filter.birthdayThisWeek} onClick={() => onChange({ birthdayThisWeek: !filter.birthdayThisWeek || undefined })}>
          Birthday this week
        </Chip>
        <Chip pressed={!!filter.hasTrainer} onClick={() => onChange({ hasTrainer: !filter.hasTrainer || undefined })}>
          Has a trainer
        </Chip>
        {filter.notVisitedDays ? (
          <div className="basis-full">
            <BoundedNumberInput
              id="cm-not-visited-days"
              label="No check-in for"
              suffix="days"
              min={1}
              max={MAX_NOT_VISITED_DAYS}
              value={filter.notVisitedDays}
              onCommit={(n) => onChange({ notVisitedDays: n })}
            />
          </div>
        ) : null}
      </ChipGroup>
    </div>
  );
}
