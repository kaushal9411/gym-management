'use client';

import * as React from 'react';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoadingButton } from '@/components/ui/loading-button';
import { cn } from '@/lib/utils';
import { toTicketError, useCreateTicket } from '../hooks/use-tickets';
import type { TicketPriority } from '../types';

const PRIORITIES: TicketPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

const textareaClassName = cn(
  'flex min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm',
  'placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
  'disabled:cursor-not-allowed disabled:opacity-50',
);

const selectClassName = cn(
  'h-9 rounded-lg border border-input bg-background px-2.5 text-sm shadow-xs transition-all duration-150',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:border-ring',
);

export function NewTicketDialog() {
  const [open, setOpen] = React.useState(false);
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
          setOpen(false);
          reset();
        },
      },
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) createTicket.reset();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="size-4" />
          New ticket
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Raise a support ticket</DialogTitle>
          <DialogDescription>Tell us what&apos;s going on — the FitCloud team will follow up here.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          {createTicket.isError ? (
            <p role="alert" className="text-sm text-destructive">
              {toTicketError(createTicket.error).message}
            </p>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="ticket-subject">Subject</Label>
            <Input
              id="ticket-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Unable to check in members at the front desk"
              disabled={createTicket.isPending}
              minLength={3}
              maxLength={200}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ticket-priority">Priority</Label>
            <select
              id="ticket-priority"
              className={cn(selectClassName, 'w-full')}
              value={priority}
              onChange={(e) => setPriority(e.target.value as TicketPriority)}
              disabled={createTicket.isPending}
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="ticket-description">Description</Label>
            <textarea
              id="ticket-description"
              className={textareaClassName}
              placeholder="Describe the issue in as much detail as you can — steps to reproduce, what you expected, what happened instead."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={createTicket.isPending}
              minLength={10}
              maxLength={5000}
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
