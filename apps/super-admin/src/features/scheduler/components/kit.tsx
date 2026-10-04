'use client';

/** Shared pieces for the scheduler pages: banner + sub-nav frame, status chips/dots, inline-confirm action bar, helpers. */
import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { ADMIN_ROUTES } from '@/constants/routes';
import { Chip, type ChipTone } from '@/features/dashboard/components/ui';
import { PageBanner } from '@/features/plans/components/banner';
import { InlineConfirm, type ConfirmCfg } from '@/features/tenants/components/detail/controls/confirm';
import { cn } from '@/lib/utils';
import type { JobRunStatus } from '../types';

const TABS = [
  { href: ADMIN_ROUTES.scheduler, label: 'Overview', exact: true },
  { href: `${ADMIN_ROUTES.scheduler}/jobs`, label: 'Jobs', exact: false },
  { href: `${ADMIN_ROUTES.scheduler}/queues`, label: 'Queues', exact: true },
  { href: `${ADMIN_ROUTES.scheduler}/failed`, label: 'Failed', exact: true },
  { href: `${ADMIN_ROUTES.scheduler}/history`, label: 'History', exact: true },
] as const;

/** Tab strip shared by the five scheduler pages (links, so each tab is a real route). */
export function SchedulerSubNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Scheduler sections" className="-mx-1 overflow-x-auto px-1">
      <ul className="flex min-w-max gap-1 border-b">
        {TABS.map((t) => {
          const active = t.exact ? pathname === t.href : pathname === t.href || pathname.startsWith(`${t.href}/`);
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  '-mb-px block rounded-t-md border-b-2 px-3.5 py-2 text-[13px] font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring',
                  active ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground',
                )}
              >
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Banner + sub-nav + body spacing. */
export function SchedulerFrame({ title, subtitle, chips, actions, above, children }: { title: React.ReactNode; subtitle?: React.ReactNode; chips?: React.ReactNode; actions?: React.ReactNode; above?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <PageBanner title={title} subtitle={subtitle} chips={chips} above={above}>{actions}</PageBanner>
      <SchedulerSubNav />
      {children}
    </div>
  );
}

const TONE: Record<JobRunStatus, ChipTone> = { COMPLETED: 'green', FAILED: 'red', RUNNING: 'blue', PENDING: 'amber', SCHEDULED: 'violet', PAUSED: 'amber', CANCELLED: 'slate' };
export const runTone = (s: JobRunStatus): ChipTone => TONE[s];
export const STATUS_COLOR: Record<JobRunStatus, string> = {
  COMPLETED: 'var(--chart-6)', FAILED: 'var(--chart-5)', RUNNING: 'var(--chart-2)', PENDING: 'var(--chart-4)', SCHEDULED: 'var(--chart-3)', PAUSED: 'var(--chart-4)', CANCELLED: 'var(--chart-7)',
};
const label = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();

export function RunChip({ status }: { status: JobRunStatus }) {
  return <Chip tone={runTone(status)}>{label(status)}</Chip>;
}

export function StatusDot({ status, className }: { status: JobRunStatus | null; className?: string }) {
  return <i aria-hidden className={cn('inline-block size-2 shrink-0 rounded-full', status === 'RUNNING' && 'animate-pulse motion-reduce:animate-none', className)} style={{ background: status ? STATUS_COLOR[status] : 'var(--muted-foreground)' }} />;
}

export function fmtMs(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return '—';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)} s`;
  return `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`;
}

const dtf = new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
export const fmtDT = (v: string | null | undefined): string => (v ? dtf.format(new Date(v)) : '—');

/** Relative time ("5m ago" / "in 3h"). Pass `now` from state so SSR/CSR agree. */
export function relative(iso: string | null | undefined, now: number | null): string {
  if (!iso) return '—';
  if (now === null) return fmtDT(iso);
  const diff = new Date(iso).getTime() - now;
  const m = Math.round(Math.abs(diff) / 60_000);
  const t = m < 1 ? 'moments' : m < 60 ? `${m}m` : m < 1440 ? `${Math.round(m / 60)}h` : `${Math.round(m / 1440)}d`;
  if (m < 1) return diff < 0 ? 'just now' : 'any moment';
  return diff < 0 ? `${t} ago` : `in ${t}`;
}

/** Client clock that is null on the server/first paint (avoids hydration mismatch), then ticks every 30 s. */
export function useNow(): number | null {
  const [now, setNow] = React.useState<number | null>(null);
  React.useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

export interface ActionDef {
  key: string;
  label: string;
  /** Confirmation copy. */
  title: string;
  text: React.ReactNode;
  confirmLabel?: string;
  destructive?: boolean;
  busy: boolean;
  run: () => Promise<unknown> | void;
}

/** Row of buttons; clicking one opens an INLINE confirmation (no modal) beneath, Cancel/Confirm. */
export function ActionBar({ actions, size = 'sm', className }: { actions: ActionDef[]; size?: 'sm' | 'default'; className?: string }) {
  const [open, setOpen] = React.useState<string | null>(null);
  const active = actions.find((a) => a.key === open);
  if (actions.length === 0) return null;
  const cfg: ConfirmCfg | null = active
    ? {
        title: active.title,
        text: active.text,
        label: active.confirmLabel ?? active.label,
        destructive: active.destructive,
        pending: active.busy,
        run: () => {
          void Promise.resolve(active.run()).finally(() => setOpen(null));
        },
      }
    : null;
  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex flex-wrap gap-1.5">
        {actions.map((a) => (
          <Button key={a.key} size={size} variant={a.key === open ? 'secondary' : 'outline'} aria-expanded={a.key === open} disabled={a.busy} onClick={() => setOpen(a.key === open ? null : a.key)}>
            {a.label}
          </Button>
        ))}
      </div>
      {cfg ? <InlineConfirm cfg={cfg} slug="" onCancel={() => setOpen(null)} /> : null}
    </div>
  );
}
