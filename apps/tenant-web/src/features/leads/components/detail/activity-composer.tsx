'use client';

import * as React from 'react';
import { toast } from 'sonner';

import { Input } from '@/components/ui/input';
import { LoadingButton } from '@/components/ui/loading-button';
import { Chip } from '@/features/finance/components/payments/payments-ui';
import { toLeadError, useAddLeadActivity } from '../../hooks/use-leads';
import { ACTIVITY_META, localInputToIso } from '../../lib/lead-meta';
import { MANUAL_ACTIVITY_TYPES, type ManualActivityType } from '../../types';
import { FieldLabel, InlineAlert, TextArea } from '../shared/lead-ui';

/** Inline activity composer: type chips, note, outcome and an optional next follow-up. */
export function ActivityComposer({ leadId, closed }: { leadId: string; closed: boolean }) {
  const add = useAddLeadActivity();
  const [type, setType] = React.useState<ManualActivityType>('NOTE');
  const [note, setNote] = React.useState('');
  const [outcome, setOutcome] = React.useState('');
  const [next, setNext] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (type === 'NOTE' && !note.trim()) return setError('Write a note first.');
    if (type === 'FOLLOW_UP' && !next) return setError('Pick the follow-up date and time.');
    setError(null);
    add.mutate(
      { id: leadId, payload: { type, note: note.trim() || undefined, outcome: outcome.trim() || undefined, nextFollowUpAt: next ? localInputToIso(next) : undefined, scheduledFor: type === 'FOLLOW_UP' && next ? localInputToIso(next) : undefined } },
      {
        onSuccess: () => {
          toast.success(`${ACTIVITY_META[type].label} logged.`);
          setNote('');
          setOutcome('');
          setNext('');
        },
        onError: (err) => setError(toLeadError(err).message),
      },
    );
  };

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl border bg-muted/30 p-3.5" aria-label="Log activity">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Activity type">
        {MANUAL_ACTIVITY_TYPES.map((t) => {
          const Icon = ACTIVITY_META[t].icon;
          return (
            <Chip key={t} small active={type === t} onClick={() => setType(t)}>
              <Icon className="size-3.5" aria-hidden /> {ACTIVITY_META[t].label}
            </Chip>
          );
        })}
      </div>
      <TextArea aria-label="Note" value={note} onChange={(e) => setNote(e.target.value)} placeholder={type === 'NOTE' ? 'Write a note...' : 'What was discussed? (optional)'} maxLength={2000} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <FieldLabel htmlFor="act-outcome">Outcome</FieldLabel>
          <Input id="act-outcome" value={outcome} onChange={(e) => setOutcome(e.target.value)} placeholder="Interested, call back..." maxLength={300} />
        </div>
        {!closed ? (
          <div>
            <FieldLabel htmlFor="act-next">Next follow-up</FieldLabel>
            <Input id="act-next" type="datetime-local" value={next} onChange={(e) => setNext(e.target.value)} />
          </div>
        ) : null}
      </div>
      {error ? <InlineAlert>{error}</InlineAlert> : null}
      <div className="flex justify-end">
        <LoadingButton type="submit" loading={add.isPending}>Log {ACTIVITY_META[type].label.toLowerCase()}</LoadingButton>
      </div>
    </form>
  );
}
