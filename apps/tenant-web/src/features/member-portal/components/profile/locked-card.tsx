'use client';

import { Building2, CalendarDays, CreditCard, Lock, ShieldCheck, UserRound } from 'lucide-react';

import type { MemberSelfProfile } from '../../services/member-profile.service';
import { formatDate } from '../../lib/format';
import { ListRow, PortalList, SectionCard } from '../kit';

/** Read-only gym-managed data. */
export function LockedCard({ profile }: { profile: MemberSelfProfile }) {
  const l = profile.locked;
  return (
    <SectionCard title="Managed by your gym" subtitle="Ask the front desk to change these" icon={Lock} tone="muted" flush>
      <PortalList>
        <ListRow icon={ShieldCheck} title={profile.memberId} subtitle="Member ID" hideChevron />
        {l.membership ? <ListRow icon={CreditCard} tone="success" title={l.membership.planName} subtitle={`Plan · ${l.membership.status} · ends ${formatDate(l.membership.endDate)}`} hideChevron /> : null}
        {l.branch ? <ListRow icon={Building2} tone="violet" title={l.branch.name} subtitle="Branch" hideChevron /> : null}
        {l.trainer ? <ListRow icon={UserRound} tone="orange" title={l.trainer.name} subtitle="Trainer" hideChevron /> : null}
        <ListRow icon={ShieldCheck} tone="info" title={l.status} subtitle="Status" hideChevron />
        <ListRow icon={CalendarDays} tone="warning" title={formatDate(l.joiningDate)} subtitle="Member since" hideChevron />
      </PortalList>
    </SectionCard>
  );
}
