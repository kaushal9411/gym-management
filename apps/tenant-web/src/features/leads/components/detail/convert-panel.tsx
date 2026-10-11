'use client';

import * as React from 'react';
import Link from 'next/link';
import { CheckCircle2, UserCheck } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoadingButton } from '@/components/ui/loading-button';
import { Select } from '@/components/ui/select';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { useBranches } from '@/features/branch/hooks/use-branches';
import { useAssignablePlans } from '@/features/members/hooks/use-members';
import { useStaffList } from '@/features/staff/hooks/use-staff';
import { toLeadError, useConvertLead } from '../../hooks/use-leads';
import type { ConvertLeadPayload, ConvertLeadResult, LeadDetail } from '../../types';
import { FieldLabel, InlineAlert, TextArea } from '../shared/lead-ui';

function TrainerField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const trainers = useStaffList({ role: 'TRAINER', status: 'ACTIVE', limit: 100 });
  return (
    <div>
      <FieldLabel htmlFor="cv-trainer">Trainer</FieldLabel>
      <Select id="cv-trainer" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">No trainer assigned</option>
        {(trainers.data?.items ?? []).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
      </Select>
    </div>
  );
}

/** Inline "Convert to member" panel mirroring the backend body. On success it links to the new member. */
export function ConvertPanel({ lead, onClose }: { lead: LeadDetail; onClose: () => void }) {
  const { hasPermission } = usePermissions();
  const convert = useConvertLead();
  const branches = useBranches();
  const plans = useAssignablePlans();
  const canPickTrainer = hasPermission('staff:view');
  const needsNames = lead.name.trim().split(/\s+/).length < 2;
  const [v, setV] = React.useState({ branchId: lead.branch?.id ?? '', firstName: '', lastName: '', planId: lead.interestedPlan?.id ?? '', startDate: '', dateOfBirth: '', trainerId: '', notes: '' });
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<ConvertLeadResult | null>(null);
  const set = (k: keyof typeof v, val: string) => setV((p) => ({ ...p, [k]: val }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!lead.branch && !v.branchId) return setError('Choose the branch the member will join.');
    if (needsNames && !(v.firstName.trim() && v.lastName.trim())) return setError('This lead has a single-word name - enter first and last name.');
    setError(null);
    const p: ConvertLeadPayload = {};
    if (v.branchId) p.branchId = v.branchId;
    if (needsNames) { p.firstName = v.firstName.trim(); p.lastName = v.lastName.trim(); }
    if (v.planId) p.planId = v.planId;
    if (v.startDate) p.startDate = v.startDate;
    if (v.dateOfBirth) p.dateOfBirth = v.dateOfBirth;
    if (v.trainerId) p.trainerId = v.trainerId;
    if (v.notes.trim()) p.notes = v.notes.trim();
    convert.mutate({ id: lead.id, payload: p }, { onSuccess: setResult, onError: (err) => setError(toLeadError(err).message) });
  };

  if (result) {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-xl border p-4" style={{ borderColor: 'color-mix(in oklch, var(--success) 45%, transparent)', backgroundColor: 'color-mix(in oklch, var(--success) 9%, transparent)' }}>
        <CheckCircle2 className="size-6" style={{ color: 'var(--success)' }} aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="font-bold">{result.member.name} is now a member ({result.member.memberId}).</p>
          <p className="text-sm text-muted-foreground">The lead is marked as converted.</p>
        </div>
        <Link href={`/members/${result.member.id}`} className="inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90">Open member</Link>
        <Button variant="ghost" onClick={onClose}>Close</Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4" aria-label="Convert lead to member">
      <p className="flex items-center gap-2 text-sm text-muted-foreground"><UserCheck className="size-4" aria-hidden /> Creates a member from {lead.name}&apos;s details (name, phone, email, goal) and optionally assigns a plan.</p>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div>
          <FieldLabel htmlFor="cv-branch">Branch {lead.branch ? '' : '*'}</FieldLabel>
          <Select id="cv-branch" value={v.branchId} onChange={(e) => set('branchId', e.target.value)}>
            <option value="">{lead.branch ? `${lead.branch.name} (lead branch)` : 'Select branch'}</option>
            {(branches.data ?? []).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </Select>
        </div>
        <div>
          <FieldLabel htmlFor="cv-plan">Membership plan</FieldLabel>
          <Select id="cv-plan" value={v.planId} onChange={(e) => set('planId', e.target.value)}>
            <option value="">No plan yet</option>
            {(plans.data ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        </div>
        <div>
          <FieldLabel htmlFor="cv-start">Start date</FieldLabel>
          <Input id="cv-start" type="date" value={v.startDate} disabled={!v.planId} onChange={(e) => set('startDate', e.target.value)} />
        </div>
        <div>
          <FieldLabel htmlFor="cv-dob">Date of birth</FieldLabel>
          <Input id="cv-dob" type="date" value={v.dateOfBirth} onChange={(e) => set('dateOfBirth', e.target.value)} />
        </div>
        {needsNames ? (
          <>
            <div><FieldLabel htmlFor="cv-fn">First name *</FieldLabel><Input id="cv-fn" value={v.firstName} onChange={(e) => set('firstName', e.target.value)} /></div>
            <div><FieldLabel htmlFor="cv-ln">Last name *</FieldLabel><Input id="cv-ln" value={v.lastName} onChange={(e) => set('lastName', e.target.value)} /></div>
          </>
        ) : null}
        {canPickTrainer ? <TrainerField value={v.trainerId} onChange={(x) => set('trainerId', x)} /> : null}
        <div className="sm:col-span-2 xl:col-span-4">
          <FieldLabel htmlFor="cv-notes">Notes</FieldLabel>
          <TextArea id="cv-notes" value={v.notes} onChange={(e) => set('notes', e.target.value)} maxLength={1000} placeholder="Added to the member record" />
        </div>
      </div>
      {error ? <InlineAlert>{error}</InlineAlert> : null}
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" onClick={onClose} disabled={convert.isPending}>Cancel</Button>
        <LoadingButton type="submit" variant="success" loading={convert.isPending}>Convert to member</LoadingButton>
      </div>
    </form>
  );
}
