'use client';

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { compactMoney } from '@/features/finance/components/payments/payments-ui';

export interface SpendPoint {
  label: string;
  amount: number;
}

/** Monthly spend bars (theme tokens only). `points` are pre-aggregated by the caller from the real payment array. */
export function SpendChart({ points, currency }: { points: SpendPoint[]; currency: string }) {
  const symbol = (() => {
    try {
      return new Intl.NumberFormat(undefined, { style: 'currency', currency }).formatToParts(0).find((p) => p.type === 'currency')?.value ?? currency;
    } catch {
      return currency;
    }
  })();
  return (
    <div className="h-[240px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }} />
          <YAxis tickLine={false} axisLine={false} width={56} tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }} tickFormatter={(v: number) => compactMoney(symbol, v)} />
          <Tooltip
            cursor={{ fill: 'var(--muted)', opacity: 0.5 }}
            contentStyle={{ background: 'var(--popover)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--popover-foreground)', fontSize: 13 }}
            formatter={(v) => [compactMoney(symbol, Number(v)), 'Paid']}
          />
          <Bar dataKey="amount" fill="var(--chart-1)" radius={[8, 8, 0, 0]} maxBarSize={44} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
