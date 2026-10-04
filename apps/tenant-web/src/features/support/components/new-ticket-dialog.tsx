'use client';

import * as React from 'react';
import { toast } from 'sonner';

import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoadingButton } from '@/components/ui/loading-button';
import { cn } from '@/lib/utils';
import { toTicketError, useCreateTicket } from '../hooks/use-tickets';
import { PRIORITY_META, PRIORITY_ORDER, SUPPORT_HERO_GRADIENT, tint } from '../lib/ticket-meta';
import type { TicketPriority } from '../types';

const SUBJECT_MAX = 200;
const DESCRIPTION_MAX = 5000;

const textareaClassName = cn(
  'flex min-h-32 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm shadow-sm',
  'placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
  'disabled:cursor-not-allowed disabled:opacity-50',
);

function Counter({ value, min, max }: { value: number; min: number; max: number }) {
  const bad = value > 0 && value < min;
  return (
    <span className={cn('text-xs tabular-nums', bad ? 'font-semibold text-destructive' : 'text-muted-foreground')}>
      {value}/{max}
      {bad ? ` · min ${min}` : ''}
    </span>
  );
}

/** Controlled by the support page (the hero / list header own the trigger buttons). Same validation as before: subject 3-200, description 10-5000. */
export function NewTicketDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [subject, setSubject] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [priority, setPriority] = React.useState<TicketPriority>('MEDIUM');
  const createTicket = useCreateTicket();

  const reset = () => {
    setSubject('');
    setDescription('');
    setPriority('MEDIUM');
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    createTicket.mutate(
      { subject: subject.trim(), description: description.trim(), priority },
      {
        onSuccess: () => {
          toast.success('Ticket raised — our team will get back to you shortly.');
          onOpenChange(false);
          reset();
        },
      },
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) createTicket.reset();
      }}
    >
      <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-[560px] gap-0 overflow-y-auto rounded-3xl p-0 [&>button:last-child]:right-5 [&>button:last-child]:top-5 [&>button:last-child]:z-10 [&>button:last-child]:bg-white/20 [&>button:last-child]:text-white [&>button:last-child]:opacity-100 [&>button:last-child]:hover:bg-white/30">
        <div className="px-6 py-[22px] text-white" style={{ backgroundImage: SUPPORT_HERO_GRADIENT }}>
          <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-white/80">Support</p>
          <DialogTitle className="mt-1 pr-10 text-[22px] font-extrabold">Raise a support ticket</DialogTitle>
          <DialogDescription className="mt-1 text-white/85">Tell us what&apos;s going on — the FitCloud team will follow up here.</DialogDescription>
        </div>
        <form onSubmit={submit} className="space-y-5 px-6 py-6">
          {createTicket.isError ? (
            <p role="alert" className="text-sm text-destructive">
              {toTicketError(createTicket.error).message}
            </p>
          ) : null}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="ticket-subject">Subject</Label>
              <Counter value={subject.length} min={3} max={SUBJECT_MAX} />
            </div>
            <Input
              id="ticket-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Unable to check in members at the front desk"
              disabled={createTicket.isPending}
              minLength={3}
              maxLength={SUBJECT_MAX}
              required
            />
          </div>
          <div className="space-y-2">
            <Label id="ticket-priority-label">Priority</Label>
            <div role="radiogroup" aria-labelledby="ticket-priority-label" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {PRIORITY_ORDER.map((p) => {
                const meta = PRIORITY_META[p];
                const active = priority === p;
                return (
                  <button
                    key={p}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    disabled={createTicket.isPending}
                    onClick={() => setPriority(p)}
                    title={meta.hint}
                    className={cn('flex flex-col items-center gap-1 rounded-xl border-2 px-2 py-2.5 text-xs font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60', !active && 'border-input hover:bg-accent')}
                    style={active ? { borderColor: meta.color, backgroundColor: tint(meta.color, 12), color: `color-mix(in oklch, ${meta.color} 75%, var(--foreground))` } : undefined}
                  >
                    <span className="size-2.5 rounded-full" style={{ backgroundColor: meta.color }} aria-hidden />
                    {meta.label}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">{PRIORITY_META[priority].hint}</p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="ticket-description">Description</Label>
              <Counter value={description.length} min={10} max={DESCRIPTION_MAX} />
            </div>
            <textarea
              id="ticket-description"
              className={textareaClassName}
              placeholder="Describe the issue in as much detail as you can — steps to reproduce, what you expected, what happened instead."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={createTicket.isPending}
              minLength={10}
              maxLength={DESCRIPTION_MAX}
              required
            />
          </div>
          <LoadingButton
            type="submit"
            className="w-full"
            disabled={subject.trim().length < 3 || description.trim().length < 10}
            loading={createTicket.isPending}
            loadingText="Submitting…"
          >
            Submit ticket
          </LoadingButton>
        </form>
      </DialogContent>
    </Dialog>
  );
}
