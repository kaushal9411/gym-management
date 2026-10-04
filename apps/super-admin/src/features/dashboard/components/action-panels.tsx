'use client';

import Link from 'next/link';

import type { AtRiskReason, DashboardOverview } from '../types';
import type { ConsoleIntent, TenantRef } from './command-console';
import { fmtInt, fmtMoneyCompact } from './format';
import { Avatar, Chip, EmptyNote, Panel, type ChipTone } from './ui';

type Select = ((t: TenantRef, intent?: ConsoleIntent) => void) | undefined;
const MAX = 5;

const REASON: Record<AtRiskReason, { label: string; tone: ChipTone }> = {
  PAYMENT_FAILED: { label: 'Payment failed', tone: 'red' },
  PAST_DUE: { label: 'Past due', tone: 'amber' },
  GRACE: { label: 'Grace period', tone: 'amber' },
  NEAR_LIMIT: { label: 'Near limit', tone: 'amber' },
  SUSPENDED_RECENTLY: { label: 'Suspended', tone: 'red' },
};

const rowCls = 'flex items-center gap-2.5 border-t py-2 first:border-t-0 first:pt-0';
const miniBtn = 'rounded-[7px] border border-input bg-card px-2.5 py-1 text-xs font-semibold outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring';
const miniPrimary = 'rounded-[7px] bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card';

export function TrialsEndingSoon({ rows, canManage, onSelect, index }: { rows: DashboardOverview['trialsExpiring']; canManage: boolean; onSelect: Select; index: number }) {
  const sorted = [...rows].sort((a, b) => a.daysLeft - b.daysLeft);
  return (
    <Panel title="Trials ending soon" hint={`${fmtInt(rows.length)} this week`} index={index} className="xl:col-span-4">
      {sorted.length === 0 ? <EmptyNote>No trials ending in the next 7 days.</EmptyNote> : (
        <ul>
          {sorted.slice(0, MAX).map((r) => (
            <li key={r.tenantId} className={rowCls}>
              <Avatar name={r.name} color={r.daysLeft <= 1 ? 'var(--chart-5)' : r.daysLeft <= 3 ? 'var(--chart-4)' : undefined} seed={r.slug} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{r.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {r.members !== null && r.members !== undefined ? `${fmtInt(r.members)} members · ` : ''}{r.plan ? `${r.plan} · ` : ''}{r.daysLeft <= 0 ? 'ends today' : `ends in ${r.daysLeft} day${r.daysLeft === 1 ? '' : 's'}`}
                </p>
              </div>
              {onSelect && canManage ? (
                <button type="button" className={miniPrimary} onClick={() => onSelect({ id: r.tenantId, slug: r.slug, name: r.name, status: 'TRIAL' }, 'extend')} aria-label={`Extend trial for ${r.name}`}>Extend</button>
              ) : (
                <Link href={`/tenants/${r.tenantId}`} className={miniBtn}>View</Link>
              )}
            </li>
          ))}
        </ul>
      )}
      {sorted.length > MAX ? <p className="mt-2 text-xs text-muted-foreground">+{sorted.length - MAX} more — next to expire shown first.</p> : null}
    </Panel>
  );
}

export function FailedPayments({ data, index }: { data: DashboardOverview; index: number }) {
  const list = data.failedPaymentsList;
  const rows = (list && list.length > 0
    ? list.map((f) => ({ id: f.tenantId, name: f.name, slug: f.slug, plan: f.plan ?? null, reason: f.reason ?? null, attempt: f.attempt ?? null, amount: f.amount === null || f.amount === undefined ? null : Number(f.amount) }))
    : list
      ? []
      : data.atRisk.filter((a) => a.reason === 'PAYMENT_FAILED').map((a) => ({ id: a.tenantId, name: a.name, slug: a.slug, plan: null, reason: a.detail, attempt: null, amount: null as number | null })));
  const total = rows.reduce((s, r) => s + (r.amount ?? 0), 0);
  const count = data.kpis.failedPayments?.value ?? rows.length;
  return (
    <Panel title="Failed payments" hint={`${fmtInt(count)}${total > 0 ? ` · ${fmtMoneyCompact(total)}` : ''}`} index={index} className="xl:col-span-4">
      {rows.length === 0 ? <EmptyNote>No failed payments in this period.</EmptyNote> : (
        <ul>
          {rows.slice(0, MAX).map((r) => (
            <li key={`${r.id}-${r.reason ?? ''}`} className={rowCls}>
              <Avatar name={r.name} color="var(--chart-5)" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{r.name}</p>
                <p className="truncate text-xs text-muted-foreground">{[r.plan, r.reason, r.attempt ? `attempt ${r.attempt}` : null, r.amount ? fmtMoneyCompact(r.amount) : null].filter(Boolean).join(' · ') || 'Payment failed'}</p>
              </div>
              <Link href={`/tenants/${r.id}`} className={miniBtn} aria-label={`View tenant ${r.name}`}>View tenant</Link>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-2 text-right"><Link href="/payments" className="text-xs font-semibold text-primary hover:underline">All payments</Link></div>
    </Panel>
  );
}

export function AtRiskTenants({ data, onSelect, index }: { data: DashboardOverview; onSelect: Select; index: number }) {
  const hideFailed = !!data.failedPaymentsList;
  const rows = data.atRisk.filter((a) => !(hideFailed && a.reason === 'PAYMENT_FAILED'));
  return (
    <Panel title="At-risk tenants" hint="usage & billing health" index={index} className="xl:col-span-4">
      {rows.length === 0 ? <EmptyNote>No tenants flagged at risk.</EmptyNote> : (
        <ul>
          {rows.slice(0, MAX).map((r) => {
            const meta = REASON[r.reason];
            const inner = (
              <>
                <Avatar name={r.name} color={meta.tone === 'red' ? 'var(--chart-5)' : 'var(--chart-4)'} />
                <span className="min-w-0 flex-1 text-left">
                  <span className="block truncate text-sm font-semibold">{r.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">{r.detail}</span>
                </span>
                <Chip tone={meta.tone}>{meta.label}</Chip>
              </>
            );
            return (
              <li key={`${r.tenantId}-${r.reason}`} className="border-t first:border-t-0">
                {onSelect ? (
                  <button type="button" onClick={() => onSelect({ id: r.tenantId, slug: r.slug, name: r.name })} aria-label={`Open console for ${r.name}`} className="flex w-full items-center gap-2.5 rounded-lg py-2 outline-none hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring">{inner}</button>
                ) : <div className="flex items-center gap-2.5 py-2">{inner}</div>}
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
