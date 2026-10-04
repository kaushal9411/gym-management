'use client';

/** Small shared pieces for the three payments pages: gradient banner shell, copy button, chips, formatters, 404 card. */
import * as React from 'react';
import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, Check, Copy, SearchX } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Chip, type ChipTone } from '@/features/dashboard/components/ui';
import { statusLabel } from '@/features/tenants/components/detail/tabs/_shared/kit';
import { cn } from '@/lib/utils';

export const BANNER_BTN = 'inline-flex h-9 items-center gap-2 rounded-[9px] border border-white/30 bg-white/15 px-3.5 text-[13px] font-semibold text-white outline-none transition-colors hover:bg-white/25 focus-visible:ring-2 focus-visible:ring-white disabled:opacity-60';
export const LINK = 'font-medium text-primary underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring rounded-sm';
export const SELECT = 'h-9 rounded-[9px] border border-input bg-card px-2.5 text-[13px] text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring';

/** Shared gradient banner (same look as the tenants list banner). */
export function Banner({ children, actions }: { children: React.ReactNode; actions?: React.ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <motion.header
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="relative flex flex-wrap items-end justify-between gap-3 overflow-hidden rounded-2xl px-6 py-5 text-white"
      style={{ background: 'radial-gradient(600px 220px at 90% -40%, rgba(94,234,212,.45), transparent 60%), linear-gradient(115deg,#0f172a,#115e59 60%,#0e7490)' }}
    >
      <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: 'repeating-linear-gradient(135deg, rgba(255,255,255,.05) 0 1px, transparent 1px 14px)' }} />
      <div className="relative min-w-0">{children}</div>
      {actions ? <div className="relative flex flex-wrap gap-2.5">{actions}</div> : null}
    </motion.header>
  );
}

export function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return <Link href={href} className={cn(LINK, 'inline-flex items-center gap-1.5 text-[13px]')}><ArrowLeft className="size-3.5" aria-hidden />{children}</Link>;
}

export function NotFoundCard({ what, message, backHref, backLabel, onRetry }: { what: string; message?: string; backHref: string; backLabel: string; onRetry?: () => void }) {
  return (
    <div className="mx-auto max-w-xl space-y-3 pt-6">
      <BackLink href={backHref}>{backLabel}</BackLink>
      <div role="alert" className="grid place-items-center gap-2 rounded-[14px] border bg-card px-4 py-14 text-center">
        <SearchX className="size-8 text-muted-foreground" aria-hidden />
        <p className="font-semibold">{what} not found</p>
        {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
        <div className="mt-1 flex gap-2">
          {onRetry ? <Button size="sm" variant="outline" onClick={onRetry}>Retry</Button> : null}
          <Button size="sm" asChild><Link href={backHref}>{backLabel}</Link></Button>
        </div>
      </div>
    </div>
  );
}

export function CopyButton({ value, label }: { value: string; label: string }) {
  const [done, setDone] = React.useState(false);
  return (
    <button
      type="button"
      aria-label={`Copy ${label}`}
      onClick={(e) => {
        e.stopPropagation();
        void navigator.clipboard.writeText(value).then(() => { setDone(true); toast.success('Copied to clipboard.'); window.setTimeout(() => setDone(false), 1500); }, () => toast.error('Copy failed.'));
      }}
      className="grid size-6 shrink-0 place-items-center rounded-md text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
    >
      {done ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
    </button>
  );
}

const PROVIDER_TONE: Record<string, ChipTone> = { RAZORPAY: 'blue', STRIPE: 'violet', PAYPAL: 'blue', MANUAL: 'slate' };
export const ProviderChip = ({ provider }: { provider: string }) => <Chip tone={PROVIDER_TONE[provider] ?? 'slate'}>{statusLabel(provider)}</Chip>;
export const ModeChip = ({ mode }: { mode: string | null }) => (mode ? <Chip tone="slate">{statusLabel(mode)}</Chip> : <span className="text-muted-foreground">—</span>);

const STATUS_TONE: Record<string, ChipTone> = { SUCCEEDED: 'green', PAID: 'green', PENDING: 'amber', OPEN: 'amber', DRAFT: 'slate', FAILED: 'red', UNCOLLECTIBLE: 'red', REFUNDED: 'violet', PARTIALLY_REFUNDED: 'violet', VOID: 'slate' };
export const StatusChip = ({ status }: { status: string }) => <Chip tone={STATUS_TONE[status] ?? 'slate'}>{statusLabel(status)}</Chip>;

export function relTime(iso: string | null | undefined, now: number | null): string {
  if (!iso) return '—';
  if (now === null) return '';
  const m = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60_000));
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return d < 365 ? `${d}d ago` : `${Math.round(d / 365)}y ago`;
}

/** Whole days past a due date (UTC), 0 when not past. */
export function daysOverdue(due: string | null, now: number | null): number {
  if (!due || now === null) return 0;
  const d = Math.floor((now - new Date(due).getTime()) / 86_400_000);
  return d > 0 ? d : 0;
}

export function tenantName(t: { name: string }): string { return t.name; }

/** Inline (in-flow) confirmation row — used instead of any dialog. */
export function ConfirmRow({ text, confirmLabel, busy, onCancel, onConfirm }: { text: string; confirmLabel: string; busy: boolean; onCancel: () => void; onConfirm: () => void }) {
  return (
    <div role="alert" className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-[13px] text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
      <span className="min-w-0 flex-1">{text}</span>
      <Button size="sm" variant="outline" onClick={onCancel} disabled={busy}>Cancel</Button>
      <Button size="sm" onClick={onConfirm} disabled={busy}>{busy ? 'Working…' : confirmLabel}</Button>
    </div>
  );
}
