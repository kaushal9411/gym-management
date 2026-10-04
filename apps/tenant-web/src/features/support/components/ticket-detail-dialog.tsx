'use client';

import { motion } from 'framer-motion';
import { Hourglass, User } from 'lucide-react';

import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/spinner';
import { avatarColor, initials } from '@/features/finance/components/payments/payments-ui';
import { useMotionSafe } from '@/features/reports/lib/motion';
import { useTicketDetail } from '../hooks/use-tickets';
import { PRIORITY_META, STATUS_META, SUPPORT_HERO_GRADIENT } from '../lib/ticket-meta';
import { TicketPriorityBadge, TicketStatusBadge } from './ticket-badges';

interface TicketDetailDialogProps {
  ticketId: string | null;
  onOpenChange: (open: boolean) => void;
}

export function TicketDetailDialog({ ticketId, onOpenChange }: TicketDetailDialogProps) {
  const { data: ticket, isLoading } = useTicketDetail(ticketId);
  const m = useMotionSafe();

  return (
    <Dialog open={ticketId !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-[600px] gap-0 overflow-y-auto rounded-3xl p-0 [&>button:last-child]:right-5 [&>button:last-child]:top-5 [&>button:last-child]:z-10 [&>button:last-child]:bg-white/20 [&>button:last-child]:text-white [&>button:last-child]:opacity-100 [&>button:last-child]:hover:bg-white/30">
        {isLoading || !ticket ? (
          <>
            <DialogTitle className="sr-only">Ticket details</DialogTitle>
            <DialogDescription className="sr-only">Loading ticket</DialogDescription>
            <div className="flex justify-center py-16">
              <Spinner />
            </div>
          </>
        ) : (
          <>
            <div className="px-6 py-[22px] text-white" style={{ backgroundImage: SUPPORT_HERO_GRADIENT }}>
              <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-white/80">
                {STATUS_META[ticket.status].label} · {PRIORITY_META[ticket.priority].label} priority
              </p>
              <DialogTitle className="mt-1 pr-10 text-[22px] font-extrabold leading-tight">{ticket.subject}</DialogTitle>
              <DialogDescription className="sr-only">Ticket details and replies from the FitCloud team.</DialogDescription>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold text-white/90">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-2.5 py-1">
                  <User className="size-3" aria-hidden /> {ticket.createdByName ?? ticket.createdByEmail}
                </span>
                <span>Raised {new Date(ticket.createdAt).toLocaleString()}</span>
              </div>
            </div>
            <div className="space-y-5 px-6 py-6">
              <div className="flex flex-wrap items-center gap-2">
                <TicketStatusBadge status={ticket.status} />
                <TicketPriorityBadge priority={ticket.priority} />
              </div>
              <p className="whitespace-pre-wrap rounded-2xl bg-muted/60 p-4 text-sm text-foreground">{ticket.description}</p>

              <div>
                <p className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Replies from our team</p>
                {ticket.notes.length > 0 ? (
                  <motion.ol className="relative space-y-4" variants={m.staggerContainer(0.08)} initial={m.initial} animate="show">
                    <span aria-hidden className="absolute bottom-2 left-[17px] top-2 w-px bg-border" />
                    {ticket.notes.map((note) => {
                      const author = note.authorAdmin?.name ?? 'FitCloud team';
                      return (
                        <motion.li key={note.id} variants={m.listItem} className="relative flex gap-3">
                          <span className="z-10 flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-extrabold text-white ring-4 ring-card" style={{ backgroundColor: avatarColor(author) }}>
                            {initials(author)}
                          </span>
                          <div className="min-w-0 flex-1 rounded-2xl border bg-card p-3 shadow-xs">
                            <div className="flex flex-wrap items-center justify-between gap-x-3 text-xs text-muted-foreground">
                              <span className="font-bold text-foreground">{author}</span>
                              <span>{new Date(note.createdAt).toLocaleString()}</span>
                            </div>
                            <p className="mt-1.5 whitespace-pre-wrap text-sm">{note.note}</p>
                          </div>
                        </motion.li>
                      );
                    })}
                  </motion.ol>
                ) : (
                  <div className="flex flex-col items-center gap-1.5 rounded-2xl border border-dashed px-4 py-7 text-center">
                    <Hourglass className="size-5 text-muted-foreground" aria-hidden />
                    <p className="text-sm font-bold">Waiting for our team</p>
                    <p className="text-[13px] text-muted-foreground">No replies yet — we&apos;ll respond here as soon as we can.</p>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
