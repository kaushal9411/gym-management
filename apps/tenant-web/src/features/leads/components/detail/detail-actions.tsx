'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { LoadingButton } from '@/components/ui/loading-button';
import { Select } from '@/components/ui/select';
import { useCurrentUser } from '@/features/auth/hooks/use-current-user';
import { PanelCard } from '@/features/finance/components/payments/payments-ui';
import { toLeadError, useAssignLead, useChangeLeadStatus, useDeleteLead, useLeadAssignees, useUpdateLead } from '../../hooks/use-leads';
import type { LeadDetail, UpdateLeadPayload } from '../../types';
import { ConvertPanel } from './convert-panel';
import { LeadForm } from '../shared/lead-form';
import { InlineAlert } from '../shared/lead-ui';
import { LostForm } from '../shared/lost-form';

export type ActionPanel = 'edit' | 'convert' | 'lost' | 'assign' | 'delete' | null;

function AssignPanel({ lead, onClose }: { lead: LeadDetail; onClose: () => void }) {
  const assignees = useLeadAssignees();
  const assign = useAssignLead();
  const me = useCurrentUser();
  const [val, setVal] = React.useState(lead.assignedTo?.id ?? '');
  const [error, setError] = React.useState<string | null>(null);
  const save = () =>
    assign.mutate({ id: lead.id, userId: val || null }, { onSuccess: () => { toast.success('Assignment updated.'); onClose(); }, onError: (e) => setError(toLeadError(e).message) });
  return (
    <div className="space-y-3">
      <Select aria-label="Assign to" value={val} onChange={(e) => setVal(e.target.value)}>
        <option value="">Unassigned</option>
        {(assignees.data ?? []).map((a) => <option key={a.id} value={a.id}>{a.id === me?.id ? `${a.name} (me)` : a.name} - {a.role.toLowerCase()}</option>)}
      </Select>
      {error ? <InlineAlert>{error}</InlineAlert> : null}
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <LoadingButton loading={assign.isPending} onClick={save}>Save assignment</LoadingButton>
      </div>
    </div>
  );
}

function DeletePanel({ lead, onClose }: { lead: LeadDetail; onClose: () => void }) {
  const del = useDeleteLead();
  const router = useRouter();
  const [error, setError] = React.useState<string | null>(null);
  return (
    <div className="space-y-3">
      <InlineAlert tone="warning">Delete {lead.name}? The lead and its history disappear from the pipeline and reports.</InlineAlert>
      {error ? <InlineAlert>{error}</InlineAlert> : null}
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>Keep lead</Button>
        <LoadingButton variant="destructive" loading={del.isPending} onClick={() => del.mutate(lead.id, { onSuccess: () => { toast.success('Lead deleted.'); router.replace('/leads'); }, onError: (e) => setError(toLeadError(e).message) })}>Yes, delete</LoadingButton>
      </div>
    </div>
  );
}

const TITLES: Record<Exclude<ActionPanel, null>, [string, string]> = {
  edit: ['Edit details', 'Update contact, interest and follow-up.'],
  convert: ['Convert to member', 'Turn this enquiry into a gym member.'],
  lost: ['Mark as lost', 'Record why the lead did not join.'],
  assign: ['Assign lead', 'Pick the staff member who owns this lead.'],
  delete: ['Delete lead', 'This cannot be undone from the app.'],
};

/** The inline panel region under the hero (no modals): edit / convert / lost / assign / delete-confirm. */
export function DetailActionPanel({ lead, panel, onClose }: { lead: LeadDetail; panel: ActionPanel; onClose: () => void }) {
  const update = useUpdateLead();
  const status = useChangeLeadStatus();
  const [lostError, setLostError] = React.useState<string | null>(null);
  if (!panel) return null;
  const [title, subtitle] = TITLES[panel];
  return (
    <PanelCard title={title} subtitle={subtitle}>
      {panel === 'edit' ? (
        <LeadForm
          mode="edit"
          lead={lead}
          onCancel={onClose}
          onSubmit={async (p: UpdateLeadPayload) => {
            try {
              await update.mutateAsync({ id: lead.id, payload: p });
              toast.success('Lead updated.');
              onClose();
            } catch (e) {
              throw toLeadError(e);
            }
          }}
        />
      ) : null}
      {panel === 'convert' ? <ConvertPanel lead={lead} onClose={onClose} /> : null}
      {panel === 'lost' ? (
        <LostForm
          busy={status.isPending}
          error={lostError}
          onCancel={onClose}
          onSubmit={(reason, note) =>
            status.mutate({ id: lead.id, payload: { status: 'LOST', lostReason: reason, lostNote: note || undefined } }, { onSuccess: () => { toast.success('Lead marked as lost.'); onClose(); }, onError: (e) => setLostError(toLeadError(e).message) })
          }
        />
      ) : null}
      {panel === 'assign' ? <AssignPanel lead={lead} onClose={onClose} /> : null}
      {panel === 'delete' ? <DeletePanel lead={lead} onClose={onClose} /> : null}
    </PanelCard>
  );
}
