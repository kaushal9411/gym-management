'use client';

import * as React from 'react';
import { toast } from 'sonner';

import { Select } from '@/components/ui/select';
import { toLeadError, useChangeLeadStatus } from '../../hooks/use-leads';
import { STATUS_META } from '../../lib/lead-meta';
import { OPEN_STATUSES, type LeadLostReason, type LeadStatus } from '../../types';
import { LostForm } from './lost-form';

/** Inline stage mover for a card: pick another open stage, or "Lost" (asks for a reason in place). CONVERTED is terminal. */
export function StageControl({ leadId, status, disabled }: { leadId: string; status: LeadStatus; disabled?: boolean }) {
  const change = useChangeLeadStatus();
  const [askLost, setAskLost] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  if (status === 'CONVERTED') return null;

  const move = (to: LeadStatus, lost?: { reason: LeadLostReason; note: string }) => {
    setError(null);
    change.mutate(
      { id: leadId, payload: { status: to, lostReason: lost?.reason, lostNote: lost?.note || undefined } },
      {
        onSuccess: () => {
          setAskLost(false);
          toast.success(to === 'LOST' ? 'Lead marked as lost.' : `Moved to ${STATUS_META[to].label}.`);
        },
        onError: (e) => {
          const msg = toLeadError(e).message;
          if (askLost) setError(msg);
          else toast.error(msg);
        },
      },
    );
  };

  return (
    <div className="space-y-2">
      <Select
        aria-label="Move to stage"
        className="h-8 text-xs"
        disabled={disabled || change.isPending}
        value={status === 'LOST' ? '' : status}
        onChange={(e) => {
          const v = e.target.value;
          if (v === 'LOST') setAskLost(true);
          else if (v) move(v as LeadStatus);
        }}
      >
        {status === 'LOST' ? <option value="">Reopen as...</option> : null}
        {OPEN_STATUSES.map((s) => (
          <option key={s} value={s}>{STATUS_META[s].label}</option>
        ))}
        {status !== 'LOST' ? <option value="LOST">Lost...</option> : null}
      </Select>
      {askLost ? <LostForm compact busy={change.isPending} error={error} onCancel={() => setAskLost(false)} onSubmit={(reason, note) => move('LOST', { reason, note })} /> : null}
    </div>
  );
}
