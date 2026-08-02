'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/spinner';
import { useTicketDetail } from '../hooks/use-tickets';
import { TicketPriorityBadge, TicketStatusBadge } from './ticket-badges';

interface TicketDetailDialogProps {
  ticketId: string | null;
  onOpenChange: (open: boolean) => void;
}

export function TicketDetailDialog({ ticketId, onOpenChange }: TicketDetailDialogProps) {
  const { data: ticket, isLoading } = useTicketDetail(ticketId);

  return (
    <Dialog open={ticketId !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        {isLoading || !ticket ? (
          <div className="flex justify-center py-10">
            <Spinner />
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="pr-6">{ticket.subject}</DialogTitle>
            </DialogHeader>
            <div className="flex items-center gap-2">
              <TicketStatusBadge status={ticket.status} />
              <TicketPriorityBadge priority={ticket.priority} />
              <span className="text-xs text-muted-foreground">
                Raised {new Date(ticket.createdAt).toLocaleString()}
              </span>
            </div>
            <p className="whitespace-pre-wrap text-sm text-foreground">{ticket.description}</p>

            {ticket.notes.length > 0 ? (
              <div className="space-y-3 border-t pt-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Replies</p>
                {ticket.notes.map((note) => (
                  <div key={note.id} className="rounded-lg border bg-muted/40 p-3">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">{note.authorAdmin?.name ?? 'FitCloud team'}</span>
                      <span>{new Date(note.createdAt).toLocaleString()}</span>
                    </div>
                    <p className="mt-1.5 whitespace-pre-wrap text-sm">{note.note}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="border-t pt-4 text-sm text-muted-foreground">No replies yet — we&apos;ll respond here as soon as we can.</p>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
