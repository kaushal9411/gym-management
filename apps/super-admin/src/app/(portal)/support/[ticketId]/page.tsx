'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useAddTicketNote, useCloseTicket, useSetTicketStatus, useTicket, toTicketError } from '@/features/support/hooks/use-tickets';
import type { TicketStatus } from '@/features/support/types';

export default function TicketDetailPage() {
  const params = useParams<{ ticketId: string }>();
  const router = useRouter();
  const { data: ticket, isLoading } = useTicket(params.ticketId);
  const setStatus = useSetTicketStatus();
  const closeTicket = useCloseTicket();
  const addNote = useAddTicketNote();
  const [reply, setReply] = React.useState('');
  const [note, setNote] = React.useState('');

  if (isLoading || !ticket) return <Skeleton className="h-96 rounded-xl" />;

  const submitReply = () => {
    if (!reply.trim()) return;
    addNote.mutate(
      { id: params.ticketId, note: reply.trim(), isInternal: false },
      { onSuccess: () => setReply(''), onError: (err) => toast.error(toTicketError(err).message) },
    );
  };

  const submitNote = () => {
    if (!note.trim()) return;
    addNote.mutate(
      { id: params.ticketId, note: note.trim(), isInternal: true },
      { onSuccess: () => setNote(''), onError: (err) => toast.error(toTicketError(err).message) },
    );
  };

  const publicReplies = ticket.notes.filter((n) => !n.isInternal);
  const internalNotes = ticket.notes.filter((n) => n.isInternal);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{ticket.subject}</h1>
          <p className="text-muted-foreground">{ticket.createdByEmail} · {ticket.tenant?.name ?? 'No tenant'} · {ticket.priority}</p>
        </div>
        <Button variant="outline" onClick={() => router.push('/support')}>Back to tickets</Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] as TicketStatus[]).map((s) => (
          <Button key={s} size="sm" variant={ticket.status === s ? 'default' : 'outline'} onClick={() => setStatus.mutate({ id: params.ticketId, status: s })}>
            {s.replace('_', ' ')}
          </Button>
        ))}
        <Button size="sm" variant="destructive" onClick={() => closeTicket.mutate(params.ticketId)}>Close ticket</Button>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Description</CardTitle></CardHeader>
        <CardContent className="text-sm">{ticket.description}</CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Reply to tenant</CardTitle>
          <p className="text-sm text-muted-foreground">Visible to {ticket.createdByEmail} on their ticket.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {publicReplies.length === 0 ? (
            <p className="text-sm text-muted-foreground">No replies sent yet.</p>
          ) : (
            publicReplies.map((n) => (
              <div key={n.id} className="rounded-md border border-primary/20 bg-primary/5 p-2.5 text-sm">
                <p>{n.note}</p>
                <p className="mt-1 text-xs text-muted-foreground">{n.authorAdmin.name} · {new Date(n.createdAt).toLocaleString()}</p>
              </div>
            ))
          )}
          <div className="flex gap-2">
            <Input
              placeholder="Reply to the tenant…"
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submitReply()}
            />
            <Button onClick={submitReply} disabled={addNote.isPending || !reply.trim()}>Send reply</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Internal notes</CardTitle>
          <p className="text-sm text-muted-foreground">Only visible to FitCloud staff.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {internalNotes.length === 0 ? <p className="text-sm text-muted-foreground">No notes yet.</p> : internalNotes.map((n) => (
            <div key={n.id} className="rounded-md border bg-muted/30 p-2.5 text-sm">
              <p>{n.note}</p>
              <p className="mt-1 text-xs text-muted-foreground">{n.authorAdmin.name} · {new Date(n.createdAt).toLocaleString()}</p>
            </div>
          ))}
          <div className="flex gap-2">
            <Input placeholder="Add an internal note…" value={note} onChange={(e) => setNote(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submitNote()} />
            <Button onClick={submitNote} disabled={addNote.isPending || !note.trim()}>Add</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
