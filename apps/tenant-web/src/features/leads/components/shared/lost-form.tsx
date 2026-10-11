'use client';

import * as React from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoadingButton } from '@/components/ui/loading-button';
import { Select } from '@/components/ui/select';
import { LOST_REASON_LABEL } from '../../lib/lead-meta';
import { LEAD_LOST_REASONS, type LeadLostReason } from '../../types';
import { InlineAlert } from './lead-ui';

/** Inline "mark as lost" form: reason (required) + optional note. No modal. */
export function LostForm({
  onSubmit,
  onCancel,
  busy,
  error,
  compact,
}: {
  onSubmit: (reason: LeadLostReason, note: string) => void;
  onCancel: () => void;
  busy?: boolean;
  error?: string | null;
  compact?: boolean;
}) {
  const [reason, setReason] = React.useState<LeadLostReason | ''>('');
  const [note, setNote] = React.useState('');
  const [missing, setMissing] = React.useState(false);
  return (
    <div className="space-y-2 rounded-xl border bg-muted/40 p-3" role="group" aria-label="Mark lead as lost">
      <Select aria-label="Lost reason" value={reason} invalid={missing && !reason} onChange={(e) => { setReason(e.target.value as LeadLostReason); setMissing(false); }} className={compact ? 'h-9' : undefined}>
        <option value="">Why was it lost?</option>
        {LEAD_LOST_REASONS.map((r) => (
          <option key={r} value={r}>{LOST_REASON_LABEL[r]}</option>
        ))}
      </Select>
      <Input aria-label="Lost note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" maxLength={500} className={compact ? 'h-9' : undefined} />
      {missing && !reason ? <p className="text-xs font-semibold text-destructive">Pick a reason first.</p> : null}
      {error ? <InlineAlert>{error}</InlineAlert> : null}
      <div className="flex justify-end gap-2">
        <Button type="button" size="sm" variant="ghost" onClick={onCancel} disabled={busy}>Cancel</Button>
        <LoadingButton type="button" size="sm" variant="destructive" loading={busy} onClick={() => (reason ? onSubmit(reason, note.trim()) : setMissing(true))}>
          Mark lost
        </LoadingButton>
      </div>
    </div>
  );
}
