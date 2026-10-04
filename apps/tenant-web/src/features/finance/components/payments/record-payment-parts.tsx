'use client';

import * as React from 'react';
import Link from 'next/link';
import { Check } from 'lucide-react';

import { Skeleton } from '@/components/ui/skeleton';
import { formatMoney } from '@/features/members/components/detail/detail-ui';
import type { MemberListItem } from '@/features/members/types';
import { useCurrencySymbol } from '@/lib/currency';
import { cn } from '@/lib/utils';
import { usePaymentList } from '../../hooks/use-finance';
import { PaymentStatusBadge } from '../finance-badges';
import { FieldLabel, MemberAvatar, PanelCard, fmtDate, num } from './payments-ui';

export function StepHeader({ n, title, hint }: { n: number; title: string; hint?: string }) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <span className="inline-flex size-[30px] shrink-0 items-center justify-center rounded-full bg-primary text-[13px] font-extrabold text-primary-foreground">{n}</span>
      <h2 className="text-[17px] font-extrabold">
        {title} {hint ? <span className="text-[13px] font-semibold text-muted-foreground">· {hint}</span> : null}
      </h2>
    </div>
  );
}

export function OptionCard({ active, onClick, disabled, children }: { active: boolean; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'min-w-[200px] flex-[1_1_200px] rounded-2xl border-2 p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60',
        active ? 'border-primary bg-primary/10' : 'border-border bg-card hover:bg-accent/50',
      )}
    >
      {children}
    </button>
  );
}

/** The 3-step indicator in the hero — step 1 done once a member is picked, step 2 once an amount is entered. */
export function HeroSteps({ hasMember, hasAmount }: { hasMember: boolean; hasAmount: boolean }) {
  const steps = [
    { label: 'Member', done: hasMember, active: !hasMember },
    { label: 'Details', done: hasMember && hasAmount, active: hasMember && !hasAmount },
    { label: 'Review', done: false, active: hasMember && hasAmount },
  ];
  return (
    <ol className="flex flex-wrap gap-[18px] text-[13px] font-bold">
      {steps.map((s, i) => (
        <li key={s.label} className={cn('inline-flex items-center gap-2', !s.done && !s.active && 'opacity-70')}>
          <span className={cn('inline-flex size-[26px] items-center justify-center rounded-full', s.done || s.active ? 'bg-white text-[#4338ca]' : 'border-2 border-white')}>
            {s.done ? <Check className="size-3.5" strokeWidth={3} /> : i + 1}
          </span>
          {s.label}
        </li>
      ))}
    </ol>
  );
}

/** Snapshot under the member search. Honest data only: "lifetime paid" has no cheap source, so it is omitted. */
export function MemberSnapshot({ member }: { member: MemberListItem }) {
  const sym = useCurrencySymbol();
  const last = usePaymentList({ page: 1, limit: 1, memberId: member.id, status: 'SUCCESS', sortBy: 'paymentDate', sortDir: 'desc' });
  const lastPayment = last.data?.items[0];
  const outstanding = num(member.outstandingAmount);
  return (
    <div className="mt-3.5 flex flex-wrap items-center gap-[18px] rounded-2xl p-4" style={{ backgroundImage: 'linear-gradient(135deg, color-mix(in oklch, var(--primary) 12%, transparent), color-mix(in oklch, var(--chart-7) 8%, transparent))' }}>
      <MemberAvatar name={member.name} seed={member.id} size={48} />
      <div className="min-w-[180px] flex-1">
        <div className="font-extrabold">{member.name}</div>
        <div className="text-[13px] font-semibold text-muted-foreground">
          {member.currentMembership ? `${member.currentMembership.planName} · active until ${fmtDate(member.currentMembership.endDate, { day: 'numeric', month: 'short', year: 'numeric' })}` : 'No active membership'}
        </div>
      </div>
      <div>
        <FieldLabel>Outstanding</FieldLabel>
        <div className="font-extrabold tabular-nums" style={{ color: outstanding > 0 ? 'var(--warning-foreground)' : undefined }}>
          {formatMoney(sym, outstanding)}
        </div>
      </div>
      <div>
        <FieldLabel>Last payment</FieldLabel>
        <div className="font-extrabold">{last.isPending ? '…' : lastPayment ? fmtDate(lastPayment.paymentDate) : '—'}</div>
      </div>
    </div>
  );
}

export function RecentPaymentsCard({ memberId }: { memberId: string | undefined }) {
  const sym = useCurrencySymbol();
  const list = usePaymentList({ page: 1, limit: 4, memberId, sortBy: 'paymentDate', sortDir: 'desc' }, { enabled: Boolean(memberId) });
  return (
    <PanelCard title="Recent for this member" className="[&_h2]:text-[15px]">
      {!memberId ? (
        <p className="text-sm text-muted-foreground">Pick a member to see their latest payments.</p>
      ) : list.isPending ? (
        <Skeleton className="h-20 w-full rounded-xl" />
      ) : (list.data?.items ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground">No payments yet.</p>
      ) : (
        (list.data?.items ?? []).map((p, i) => (
          <div key={p.id} className={cn('flex items-center justify-between gap-2 py-2.5 text-sm font-semibold', i > 0 && 'border-t')}>
            <Link href={`/payments/${p.id}`} className="tabular-nums hover:underline">
              {p.paymentNumber}
            </Link>
            <span className="flex items-center gap-2">
              <span className="tabular-nums">{formatMoney(sym, p.finalAmount)}</span>
              <PaymentStatusBadge status={p.status} />
            </span>
          </div>
        ))
      )}
    </PanelCard>
  );
}

export function SummaryCard({
  amount,
  discount,
  tax,
  total,
  online,
  invoiceNote,
  submit,
}: {
  amount: number;
  discount: number;
  tax: number;
  total: number;
  online: boolean;
  invoiceNote: React.ReactNode;
  submit: React.ReactNode;
}) {
  const sym = useCurrencySymbol();
  return (
    <PanelCard title="Summary">
      <div className="text-sm font-semibold text-foreground/80">
        <div className="flex justify-between py-2.5">
          <span>Amount</span>
          <span className="tabular-nums">{formatMoney(sym, amount)}</span>
        </div>
        <div className="flex justify-between border-t py-2.5">
          <span>Discount</span>
          <span className="tabular-nums" style={{ color: 'var(--success)' }}>
            − {formatMoney(sym, discount)}
          </span>
        </div>
        <div className="flex justify-between border-t py-2.5">
          <span>Tax</span>
          <span className="tabular-nums">{formatMoney(sym, tax)}</span>
        </div>
      </div>
      <div className="mt-1.5 flex items-center justify-between rounded-2xl px-4 py-4 text-white" style={{ backgroundImage: 'linear-gradient(115deg, #4338ca, #7c3aed 62%, #c026d3)' }}>
        <span className="font-bold">{online ? 'Total to collect' : 'Total received'}</span>
        <span className="text-[26px] font-extrabold tabular-nums">{formatMoney(sym, total)}</span>
      </div>
      <p className="mt-3.5 text-[13px] font-semibold leading-relaxed text-muted-foreground">{invoiceNote}</p>
      <div className="mt-[18px] flex flex-col gap-2.5">{submit}</div>
    </PanelCard>
  );
}
