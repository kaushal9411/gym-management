'use client';

import { AlertTriangle } from 'lucide-react';

import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { accentHeroGradient } from '@/features/reports/lib/reports-theme';
import { COMM_ACCENT } from '../constants';
import type { MessageLogItem } from '../types';
import { MessageLogChannelBadge, MessageLogStatusBadge } from './message-log-badges';

/** Full send record: recipient, subject (email only), full content and, for a failure/skip, why. Content is already on the list item — no extra fetch needed. */
export function MessageLogDetailDialog({ item, onOpenChange }: { item: MessageLogItem | null; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={item !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-[560px] gap-0 overflow-y-auto rounded-3xl p-0 [&>button:last-child]:right-5 [&>button:last-child]:top-5 [&>button:last-child]:z-10 [&>button:last-child]:bg-white/20 [&>button:last-child]:text-white [&>button:last-child]:opacity-100 [&>button:last-child]:hover:bg-white/30">
        {item ? (
          <>
            <div className="px-6 py-[22px] text-white" style={{ backgroundImage: accentHeroGradient(COMM_ACCENT) }}>
              <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-white/80">{item.channel} · {new Date(item.createdAt).toLocaleString()}</p>
              <DialogTitle className="mt-1 pr-10 text-[18px] font-extrabold leading-tight">{item.subject ?? item.recipient}</DialogTitle>
              <DialogDescription className="sr-only">Message log entry details.</DialogDescription>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold text-white/90">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-2.5 py-1">{item.recipient}</span>
              </div>
            </div>
            <div className="space-y-4 px-6 py-6">
              <div className="flex flex-wrap items-center gap-2">
                <MessageLogChannelBadge channel={item.channel} />
                <MessageLogStatusBadge status={item.status} />
              </div>
              <p className="whitespace-pre-wrap rounded-2xl bg-muted/60 p-4 text-sm text-foreground">{item.content}</p>
              {item.errorMessage ? (
                <p className="flex items-start gap-2 rounded-xl bg-destructive/10 p-3 text-xs font-semibold text-destructive">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden /> {item.errorMessage}
                </p>
              ) : null}
              {item.providerRef ? <p className="text-xs text-muted-foreground">Provider reference: <span className="font-mono">{item.providerRef}</span></p> : null}
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
