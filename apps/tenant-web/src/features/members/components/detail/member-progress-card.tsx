'use client';

import { IdCard } from 'lucide-react';

import type { MemberDetail } from '@/features/members/types';
import { useCurrencySymbol } from '@/lib/currency';
import { PanelCard, accentVar, formatMoney, tint } from './detail-ui';

export function MemberProgressCard({ data }: { data: MemberDetail }) {
  const symbol = useCurrencySymbol();
  const m = data.currentMembership;
  const history = data.membershipHistory.find((h) => h.id === m?.id);
  if (!m) return null;

  const start = new Date(m.startDate).getTime();
  const end = new Date(m.endDate).getTime();
  const now = Date.now();
  const total = Math.max(1, Math.ceil((end - start) / 86_400_000));
  const left = Math.max(0, Math.ceil((end - now) / 86_400_000));
  const pending = m.status === 'PENDING' || now < start;
  const percentLeft = pending ? 100 : Math.max(0, Math.min(100, (left / total) * 100));

  return (
    <PanelCard icon={IdCard} accent="aqua" title="Membership progress" delay={0.3}>
      <div
        className="mx-auto grid size-32 place-items-center rounded-full"
        style={{ backgroundImage: `conic-gradient(${accentVar('aqua')} ${percentLeft}%, ${tint('aqua', 16)} 0)` }}
        role="img"
        aria-label={`${left} days left of ${total}`}
      >
        <div className="grid size-24 place-items-center rounded-full bg-card text-center leading-tight">
          <div>
            <b className="block text-3xl font-extrabold tabular-nums">{pending ? total : left}</b>
            <span className="text-[11px] text-muted-foreground">{pending ? 'days (not started)' : 'days left'}</span>
          </div>
        </div>
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
        <dt className="text-muted-foreground">Plan</dt>
        <dd className="text-right font-semibold">{m.planName}</dd>
        <dt className="text-muted-foreground">Starts</dt>
        <dd className="text-right font-semibold tabular-nums">{new Date(m.startDate).toLocaleDateString()}</dd>
        <dt className="text-muted-foreground">Ends</dt>
        <dd className="text-right font-semibold tabular-nums">{new Date(m.endDate).toLocaleDateString()}</dd>
        {history ? (
          <>
            <dt className="text-muted-foreground">Price</dt>
            <dd className="text-right font-semibold tabular-nums">{formatMoney(symbol, history.priceAtAssignment)}</dd>
          </>
        ) : null}
      </dl>
    </PanelCard>
  );
}
