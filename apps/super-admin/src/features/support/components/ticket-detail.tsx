'use client';

/**
 * /support/[ticketId] — banner, status controls, chat-style thread (tenant request, staff replies, internal notes distinguished)
 * and a details side panel. Same hooks/endpoints as before: setStatus, close, addNote(isInternal false = reply the tenant sees,
 * true = staff-only). Close now asks inline first. Dropped: assign UI (never existed on this page; `useAssignTicket` hook is
 * kept), attachments/typing/read receipts (not in the API).
 */
import * as React from 'react';
import { useParams } from 'next/navigation';
import { motion, useReducedMotion } from 'framer-motion';
import { Lock, Send } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, Panel, Segmented } from '@/features/dashboard/components/ui';
import { useNow } from '@/features/dashboard/components/use-now';
import { Banner, BackLink, ConfirmRow, NotFoundCard } from '@/features/payments/components/pay-kit';
import { fmtDateTime, relTime, statusLabel } from '@/features/tenants/components/detail/tabs/_shared/kit';
import { cn } from '@/lib/utils';
import { toTicketError, useAddTicketNote, useCloseTicket, useSetTicketStatus, useTicket } from '../hooks/use-tickets';
import type { TicketNote, TicketStatus } from '../types';
import { AgeBadge, STATUSES, TicketPriorityChip, TicketStatusChip } from './support-kit';

function Bubble({ who, when, text, tone, index, label, mine }: { who: string; when: string; text: string; tone: 'tenant' | 'reply' | 'internal'; index: number; label?: string; mine?: boolean }) {
  const reduce = useReducedMotion();
  return (
    <motion.li
      initial={reduce ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: reduce ? 0 : Math.min(index, 8) * 0.03 }}
      className={cn('flex gap-2.5', mine && 'flex-row-reverse')}
    >
      <Avatar name={who} />
      <div className={cn('min-w-0 max-w-[85%]', mine && 'text-right')}>
        <p className="text-xs text-muted-foreground"><b className="font-semibold text-foreground">{who}</b>{label ? ` · ${label}` : ''} · {when}</p>
        <div className={cn(
          'mt-1 whitespace-pre-wrap break-words rounded-2xl border px-3.5 py-2.5 text-left text-[13.5px] leading-relaxed',
          tone === 'tenant' && 'rounded-tl-sm bg-muted/60',
          tone === 'reply' && 'rounded-tr-sm border-primary/25 bg-primary/10',
          tone === 'internal' && 'border-dashed border-amber-400/70 bg-amber-50 text-amber-950 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100',
        )}>
          {tone === 'internal' ? <span className="mb-1 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide"><Lock className="size-3" aria-hidden />Internal — staff only</span> : null}
          {text}
        </div>
      </div>
    </motion.li>
  );
}

export function TicketDetailPage() {
  const params = useParams<{ ticketId: string }>();
  const id = params.ticketId;
  const now = useNow();
  const { data: ticket, isLoading, isError, error, refetch } = useTicket(id);
  const setStatus = useSetTicketStatus();
  const closeTicket = useCloseTicket();
  const addNote = useAddTicketNote();
  const [mode, setMode] = React.useState<'reply' | 'note'>('reply');
  const [text, setText] = React.useState('');
  const [confirmClose, setConfirmClose] = React.useState(false);
  const endRef = React.useRef<HTMLDivElement>(null);

  if (isLoading) return <div className="mx-auto max-w-[1200px] space-y-4"><Skeleton className="h-24 rounded-2xl" /><Skeleton className="h-96 rounded-[14px]" /></div>;
  if (isError || !ticket) return <NotFoundCard what="Ticket" message={error?.message} backHref="/support" backLabel="Back to tickets" onRetry={() => void refetch()} />;

  const send = () => {
    const note = text.trim();
    if (!note) return;
    addNote.mutate(
      { id, note, isInternal: mode === 'note' },
      { onSuccess: () => { setText(''); toast.success(mode === 'note' ? 'Internal note added.' : 'Reply sent to the tenant.'); window.setTimeout(() => endRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 150); }, onError: (err) => toast.error(toTicketError(err).message) },
    );
  };
  const changeStatus = (s: TicketStatus) => setStatus.mutate({ id, status: s }, { onSuccess: () => toast.success(`Status set to ${statusLabel(s)}.`), onError: (err) => toast.error(toTicketError(err).message) });
  const doClose = () => closeTicket.mutate(id, { onSuccess: () => { setConfirmClose(false); toast.success('Ticket closed.'); }, onError: (err) => toast.error(toTicketError(err).message) });

  const notes: TicketNote[] = [...ticket.notes].sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));
  const replies = notes.filter((n) => !n.isInternal).length;
  const requester = ticket.createdByName || ticket.createdByEmail;

  return (
    <div className="mx-auto max-w-[1200px] space-y-4">
      <BackLink href="/support">Back to tickets</BackLink>
      <Banner>
        <div className="flex flex-wrap items-center gap-2"><TicketStatusChip status={ticket.status} /><TicketPriorityChip priority={ticket.priority} /></div>
        <h1 className="mt-1.5 break-words text-2xl font-bold tracking-tight">{ticket.subject}</h1>
        <p className="mt-0.5 text-[13px] text-teal-100">{ticket.createdByEmail} · {ticket.tenant?.name ?? 'No tenant'} · opened {relTime(ticket.createdAt, now)}</p>
      </Banner>

      <section aria-label="Ticket status" className="space-y-2 rounded-[14px] border bg-card p-3.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 text-xs font-semibold text-muted-foreground">Status</span>
          {STATUSES.map((s) => (
            <Button key={s} size="sm" variant={ticket.status === s ? 'default' : 'outline'} aria-pressed={ticket.status === s} disabled={setStatus.isPending} onClick={() => changeStatus(s)}>{statusLabel(s)}</Button>
          ))}
          <Button size="sm" variant="destructive" className="ml-auto" onClick={() => setConfirmClose(true)} disabled={confirmClose}>Close ticket</Button>
        </div>
        {confirmClose ? <ConfirmRow text="Close this ticket? The tenant will see it as closed." confirmLabel="Close ticket" busy={closeTicket.isPending} onCancel={() => setConfirmClose(false)} onConfirm={doClose} /> : null}
      </section>

      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <Panel title="Conversation" hint={`${replies} repl${replies === 1 ? 'y' : 'ies'} · ${notes.length - replies} internal`} bodyClassName="space-y-4">
          <ul className="space-y-4" aria-live="polite">
            <Bubble index={0} who={requester} when={fmtDateTime(ticket.createdAt)} text={ticket.description} tone="tenant" label="Tenant request" />
            {notes.map((n, i) => (
              <Bubble key={n.id} index={i + 1} who={n.authorAdmin.name} when={fmtDateTime(n.createdAt)} text={n.note} tone={n.isInternal ? 'internal' : 'reply'} label={n.isInternal ? undefined : 'Reply to tenant'} mine />
            ))}
          </ul>
          {notes.length === 0 ? <p className="text-center text-xs text-muted-foreground">No replies or notes yet.</p> : null}
          <div ref={endRef} />
          <div className={cn('space-y-2 rounded-xl border p-3', mode === 'note' ? 'border-dashed border-amber-400/70 bg-amber-50/60 dark:border-amber-500/40 dark:bg-amber-500/5' : 'bg-muted/30')}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Segmented label="Message type" value={mode} onChange={setMode} options={[{ value: 'reply', label: 'Reply to tenant' }, { value: 'note', label: 'Internal note' }]} />
              <p className="text-xs text-muted-foreground">{mode === 'reply' ? `Visible to ${ticket.createdByEmail}` : 'Only visible to FitCloud staff'}</p>
            </div>
            <label className="sr-only" htmlFor="ticket-compose">{mode === 'reply' ? 'Reply to the tenant' : 'Internal note'}</label>
            <textarea
              id="ticket-compose" rows={3} maxLength={2000} value={text} onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) send(); }}
              placeholder={mode === 'reply' ? 'Write a reply to the tenant…' : 'Add an internal note…'}
              className="w-full resize-y rounded-[9px] border border-input bg-card px-3 py-2 text-[13.5px] outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground tabular-nums">{text.length}/2000 · Ctrl+Enter to send</span>
              <Button onClick={send} disabled={addNote.isPending || !text.trim()}><Send className="size-4" aria-hidden />{mode === 'reply' ? 'Send reply' : 'Add note'}</Button>
            </div>
          </div>
        </Panel>

        <Panel title="Details" index={1} className="h-fit">
          <dl className="space-y-3 text-[13px]">
            {([
              ['Requester', requester],
              ['Email', ticket.createdByEmail],
              ['Tenant', ticket.tenant ? `${ticket.tenant.name} (${ticket.tenant.slug})` : 'No tenant'],
              ['Assigned to', ticket.assignedAdmin?.name ?? 'Unassigned'],
              ['Created', fmtDateTime(ticket.createdAt)],
            ] as const).map(([k, v]) => (
              <div key={k}><dt className="text-xs font-medium text-muted-foreground">{k}</dt><dd className="break-words font-medium">{v}</dd></div>
            ))}
            <div><dt className="text-xs font-medium text-muted-foreground">Age</dt><dd className="mt-0.5"><AgeBadge iso={ticket.createdAt} status={ticket.status} now={now} /></dd></div>
          </dl>
        </Panel>
      </div>
    </div>
  );
}
