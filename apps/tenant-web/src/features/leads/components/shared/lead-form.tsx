'use client';

import * as React from 'react';

import { Input } from '@/components/ui/input';
import { LoadingButton } from '@/components/ui/loading-button';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { useCurrentUser } from '@/features/auth/hooks/use-current-user';
import { useBranches } from '@/features/branch/hooks/use-branches';
import { useAssignablePlans } from '@/features/members/hooks/use-members';
import { LeadError, useLeadAssignees } from '../../hooks/use-leads';
import { isoToLocalInput, localInputToIso, SOURCE_META } from '../../lib/lead-meta';
import { LEAD_SOURCES, type CreateLeadPayload, type LeadDetail, type LeadListItem, type LeadSource, type UpdateLeadPayload } from '../../types';
import { DuplicateBanner } from './duplicate-banner';
import { FieldLabel, InlineAlert, TextArea } from './lead-ui';

interface FormValues {
  name: string;
  phone: string;
  email: string;
  source: LeadSource;
  sourceDetail: string;
  branchId: string;
  interestedPlanId: string;
  assignedToUserId: string;
  interest: string;
  nextFollowUpAt: string;
  expectedJoinDate: string;
  notes: string;
}

function initialValues(lead: LeadListItem | undefined, meId: string): FormValues {
  return {
    name: lead?.name ?? '',
    phone: lead?.phone ?? '',
    email: lead?.email ?? '',
    source: lead?.source ?? 'WALK_IN',
    sourceDetail: lead?.sourceDetail ?? '',
    branchId: lead?.branch?.id ?? '',
    interestedPlanId: lead?.interestedPlan?.id ?? '',
    assignedToUserId: lead ? (lead.assignedTo?.id ?? '') : meId,
    interest: lead?.interest ?? '',
    nextFollowUpAt: isoToLocalInput(lead?.nextFollowUpAt),
    expectedJoinDate: lead?.expectedJoinDate?.slice(0, 10) ?? '',
    notes: lead?.notes ?? '',
  };
}

type Props =
  | { mode: 'create'; canAssign: boolean; onSubmit: (p: CreateLeadPayload) => Promise<void>; onCancel: () => void }
  | { mode: 'edit'; lead: LeadDetail; canAssign?: false; onSubmit: (p: UpdateLeadPayload) => Promise<void>; onCancel: () => void };

/** Inline create / quick-edit form. Surfaces the 409 duplicate list as a banner with links. */
export function LeadForm(props: Props) {
  const me = useCurrentUser();
  const lead = props.mode === 'edit' ? props.lead : undefined;
  const [v, setV] = React.useState<FormValues>(() => initialValues(lead, props.mode === 'create' && props.canAssign ? (me?.id ?? '') : ''));
  const [err, setErr] = React.useState<LeadError | null>(null);
  const [fieldErr, setFieldErr] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const branches = useBranches();
  const plans = useAssignablePlans();
  const assignees = useLeadAssignees();
  const set = <K extends keyof FormValues>(k: K, val: FormValues[K]) => setV((p) => ({ ...p, [k]: val }));
  const closed = lead ? lead.status === 'CONVERTED' || lead.status === 'LOST' : false;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (!v.name.trim() || v.name.trim().length < 2) return setFieldErr('Enter the lead name.');
    if (v.phone.replace(/\D/g, '').length < 7) return setFieldErr('Enter a valid phone number.');
    setFieldErr(null);
    setBusy(true);
    try {
      if (props.mode === 'create') {
        const p: CreateLeadPayload = { name: v.name.trim(), phone: v.phone.trim(), source: v.source };
        if (v.email.trim()) p.email = v.email.trim();
        if (v.sourceDetail.trim()) p.sourceDetail = v.sourceDetail.trim();
        if (v.branchId) p.branchId = v.branchId;
        if (v.interestedPlanId) p.interestedPlanId = v.interestedPlanId;
        if (props.canAssign && v.assignedToUserId) p.assignedToUserId = v.assignedToUserId;
        if (v.interest.trim()) p.interest = v.interest.trim();
        if (v.nextFollowUpAt) p.nextFollowUpAt = localInputToIso(v.nextFollowUpAt);
        if (v.expectedJoinDate) p.expectedJoinDate = v.expectedJoinDate;
        if (v.notes.trim()) p.notes = v.notes.trim();
        await props.onSubmit(p);
      } else {
        const o = initialValues(props.lead, '');
        const p: UpdateLeadPayload = {};
        if (v.name.trim() !== o.name) p.name = v.name.trim();
        if (v.phone.trim() !== o.phone) p.phone = v.phone.trim();
        if (v.email.trim() !== o.email) p.email = v.email.trim() || null;
        if (v.source !== o.source) p.source = v.source;
        if (v.sourceDetail.trim() !== o.sourceDetail) p.sourceDetail = v.sourceDetail.trim() || null;
        if (v.branchId !== o.branchId) p.branchId = v.branchId || null;
        if (v.interestedPlanId !== o.interestedPlanId) p.interestedPlanId = v.interestedPlanId || null;
        if (v.interest.trim() !== o.interest) p.interest = v.interest.trim() || null;
        if (v.nextFollowUpAt !== o.nextFollowUpAt) p.nextFollowUpAt = localInputToIso(v.nextFollowUpAt) ?? null;
        if (v.expectedJoinDate !== o.expectedJoinDate) p.expectedJoinDate = v.expectedJoinDate || null;
        if (v.notes.trim() !== o.notes) p.notes = v.notes.trim() || null;
        if (Object.keys(p).length === 0) return props.onCancel();
        await props.onSubmit(p);
      }
    } catch (error) {
      setErr(error instanceof LeadError ? error : null);
      if (!(error instanceof LeadError)) setFieldErr('Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const f = props.mode === 'create' ? 'new' : 'edit';
  return (
    <form onSubmit={submit} noValidate className="space-y-4" aria-label={props.mode === 'create' ? 'New lead' : 'Edit lead'}>
      {err?.duplicates.length ? <DuplicateBanner message={err.message} duplicates={err.duplicates} /> : err ? <InlineAlert>{err.message}</InlineAlert> : null}
      {fieldErr ? <InlineAlert>{fieldErr}</InlineAlert> : null}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div>
          <FieldLabel htmlFor={`${f}-name`}>Name *</FieldLabel>
          <Input id={`${f}-name`} name="name" value={v.name} onChange={(e) => set('name', e.target.value)} placeholder="Full name" autoComplete="off" />
        </div>
        <div>
          <FieldLabel htmlFor={`${f}-phone`}>Phone *</FieldLabel>
          <Input id={`${f}-phone`} name="phone" type="tel" value={v.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+91 90000 00000" autoComplete="off" />
        </div>
        <div>
          <FieldLabel htmlFor={`${f}-email`}>Email</FieldLabel>
          <Input id={`${f}-email`} name="email" type="email" value={v.email} onChange={(e) => set('email', e.target.value)} placeholder="name@example.com" autoComplete="off" />
        </div>
        <div>
          <FieldLabel htmlFor={`${f}-source`}>Source</FieldLabel>
          <Select id={`${f}-source`} value={v.source} onChange={(e) => set('source', e.target.value as LeadSource)}>
            {LEAD_SOURCES.map((s) => (
              <option key={s} value={s}>{SOURCE_META[s].label}</option>
            ))}
          </Select>
        </div>
        <div>
          <FieldLabel htmlFor={`${f}-sd`}>Source detail</FieldLabel>
          <Input id={`${f}-sd`} value={v.sourceDetail} onChange={(e) => set('sourceDetail', e.target.value)} placeholder="Campaign, referrer..." maxLength={200} />
        </div>
        <div>
          <FieldLabel htmlFor={`${f}-plan`}>Interested plan</FieldLabel>
          <Select id={`${f}-plan`} value={v.interestedPlanId} onChange={(e) => set('interestedPlanId', e.target.value)}>
            <option value="">Not specified</option>
            {(plans.data ?? []).map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </Select>
        </div>
        <div>
          <FieldLabel htmlFor={`${f}-branch`}>Branch</FieldLabel>
          <Select id={`${f}-branch`} value={v.branchId} onChange={(e) => set('branchId', e.target.value)}>
            <option value="">No branch</option>
            {(branches.data ?? []).map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </Select>
        </div>
        {props.mode === 'create' && props.canAssign ? (
          <div>
            <FieldLabel htmlFor={`${f}-assignee`}>Assigned to</FieldLabel>
            <Select id={`${f}-assignee`} value={v.assignedToUserId} onChange={(e) => set('assignedToUserId', e.target.value)}>
              <option value="">Unassigned</option>
              {(assignees.data ?? []).map((a) => (
                <option key={a.id} value={a.id}>{a.id === me?.id ? `${a.name} (me)` : a.name}</option>
              ))}
            </Select>
          </div>
        ) : null}
        <div>
          <FieldLabel htmlFor={`${f}-fu`}>Next follow-up</FieldLabel>
          <Input id={`${f}-fu`} type="datetime-local" value={v.nextFollowUpAt} disabled={closed} onChange={(e) => set('nextFollowUpAt', e.target.value)} />
        </div>
        <div>
          <FieldLabel htmlFor={`${f}-join`}>Expected join date</FieldLabel>
          <Input id={`${f}-join`} type="date" value={v.expectedJoinDate} onChange={(e) => set('expectedJoinDate', e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <FieldLabel htmlFor={`${f}-interest`}>Interest / goal</FieldLabel>
          <Input id={`${f}-interest`} value={v.interest} onChange={(e) => set('interest', e.target.value)} placeholder="Weight loss, strength, yoga..." maxLength={300} />
        </div>
        <div className="sm:col-span-2 xl:col-span-4">
          <FieldLabel htmlFor={`${f}-notes`}>Notes</FieldLabel>
          <TextArea id={`${f}-notes`} value={v.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Anything worth remembering..." maxLength={2000} />
        </div>
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" onClick={props.onCancel} disabled={busy}>Cancel</Button>
        <LoadingButton type="submit" loading={busy}>{props.mode === 'create' ? 'Create lead' : 'Save changes'}</LoadingButton>
      </div>
    </form>
  );
}
