'use client';

/**
 * One lead in a dialog: who they are, what they asked, status buttons and internal notes.
 * Status changes save at once; notes save on the Save button (the field shows whether it is unsaved).
 * Delete asks inline first. Every write goes through PATCH/DELETE /admin/leads/:id.
 */
import * as React from 'react';
import { Building2, Mail, Phone, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Avatar, Segmented } from '@/features/dashboard/components/ui';
import { ConfirmRow } from '@/features/payments/components/pay-kit';
import { fmtDateTime } from '@/features/tenants/components/detail/tabs/_shared/kit';
import { toLeadError, useDeleteLead, useUpdateLead } from '../hooks/use-leads';
import type { Lead, LeadStatus } from '../types';
import { LEAD_STATUSES, LeadTopicChip, SIZE_LABEL, SOURCE_LABEL, STATUS_LABEL } from './lead-kit';

const NOTES_MAX = 4000;

function Row({ icon: Icon, label, children }: { icon: React.ComponentType<{ className?: string }>; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 text-[13px]">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <div className="break-words">{children}</div>
      </div>
    </div>
  );
}

export function LeadDetailDialog({ lead, onChange, onClose }: { lead: Lead | null; onChange: (lead: Lead) => void; onClose: () => void }) {
  return (
    <Dialog open={lead !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        {/* Keyed so notes and the delete confirmation reset when another lead opens. */}
        {lead ? <LeadBody key={lead.id} lead={lead} onChange={onChange} onClose={onClose} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function LeadBody({ lead, onChange, onClose }: { lead: Lead; onChange: (lead: Lead) => void; onClose: () => void }) {
  const update = useUpdateLead();
  const remove = useDeleteLead();
  const [notes, setNotes] = React.useState(lead.notes ?? '');
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const dirty = notes.trim() !== (lead.notes ?? '');
  const tooLong = notes.length > NOTES_MAX;

  const setStatus = (status: LeadStatus) => {
    if (status === lead.status) return;
    update.mutate(
      { id: lead.id, status },
      { onSuccess: (saved) => { onChange(saved); toast.success(`Marked as ${STATUS_LABEL[status].toLowerCase()}.`); }, onError: (e) => toast.error(toLeadError(e).message) },
    );
  };
  const saveNotes = () =>
    update.mutate(
      { id: lead.id, notes: notes.trim() === '' ? null : notes.trim() },
      { onSuccess: (saved) => { onChange(saved); toast.success('Notes saved.'); }, onError: (e) => toast.error(toLeadError(e).message) },
    );
  const doDelete = () =>
    remove.mutate(lead.id, {
      onSuccess: () => {
        toast.success('Lead deleted.');
        onClose();
      },
      onError: (e) => toast.error(toLeadError(e).message),
    });

  return (
    <>
      <DialogHeader>
        <div className="flex items-center gap-3">
          <Avatar name={lead.name} />
          <div className="min-w-0">
            <DialogTitle className="truncate">{lead.name}</DialogTitle>
            <DialogDescription>Received {fmtDateTime(lead.createdAt)}</DialogDescription>
          </div>
          <div className="ml-auto shrink-0">
            <LeadTopicChip topic={lead.topic} />
          </div>
        </div>
      </DialogHeader>

      <div className="grid gap-3 sm:grid-cols-2">
        <Row icon={Mail} label="Email">
          <a className="text-primary underline-offset-2 hover:underline" href={`mailto:${lead.email}`}>{lead.email}</a>
        </Row>
        <Row icon={Phone} label="Phone">
          {lead.phone ? <a className="text-primary underline-offset-2 hover:underline" href={`tel:${lead.phone.replace(/\s/g, '')}`}>{lead.phone}</a> : <span className="text-muted-foreground">Not given</span>}
        </Row>
        <Row icon={Building2} label="Gym">
          {lead.gymName ?? lead.gymSlug ?? <span className="text-muted-foreground">Not given</span>}
          {lead.gymSize ? <span className="block text-xs text-muted-foreground">{SIZE_LABEL[lead.gymSize] ?? lead.gymSize}</span> : null}
        </Row>
        <Row icon={Mail} label="Came from">
          {SOURCE_LABEL[lead.source] ?? lead.source}
        </Row>
      </div>

      <div>
        <p className="mb-1.5 text-xs font-medium text-muted-foreground">Message</p>
        <p className="whitespace-pre-wrap break-words rounded-xl border bg-muted/40 px-3.5 py-3 text-[13.5px] leading-relaxed">{lead.message}</p>
      </div>

      <div className="space-y-1.5">
        <p className="text-xs font-medium text-muted-foreground">
          Status{lead.contactedAt ? <span className="ml-2 font-normal">First contacted {fmtDateTime(lead.contactedAt)}</span> : null}
        </p>
        <Segmented<LeadStatus>
          label="Lead status"
          value={lead.status}
          onChange={setStatus}
          options={LEAD_STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s], disabled: update.isPending }))}
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="lead-notes" className="flex items-baseline justify-between text-xs font-medium text-muted-foreground">
          <span>Internal notes</span>
          <span className={tooLong ? 'text-destructive' : ''}>{notes.length}/{NOTES_MAX}</span>
        </label>
        <textarea
          id="lead-notes"
          rows={4}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Call outcome, quote sent, follow-up date…"
          aria-invalid={tooLong}
          className="w-full resize-y rounded-xl border bg-card px-3 py-2.5 text-[13.5px] outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        {tooLong ? <p role="alert" className="text-xs text-destructive">Notes can be at most {NOTES_MAX} characters.</p> : null}
        <div className="flex justify-end">
          <Button size="sm" onClick={saveNotes} disabled={!dirty || tooLong || update.isPending}>
            {update.isPending ? 'Saving…' : dirty ? 'Save notes' : 'Saved'}
          </Button>
        </div>
      </div>

      <div className="border-t pt-3">
        {confirmDelete ? (
          <ConfirmRow text="Delete this lead for good?" confirmLabel="Delete lead" busy={remove.isPending} onCancel={() => setConfirmDelete(false)} onConfirm={doDelete} />
        ) : (
          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setConfirmDelete(true)}>
            <Trash2 className="mr-1.5 size-4" aria-hidden />
            Delete lead
          </Button>
        )}
      </div>
    </>
  );
}
