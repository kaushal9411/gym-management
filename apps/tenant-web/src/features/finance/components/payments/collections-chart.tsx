'use client';

import * as React from 'react';
import { Area, CartesianGrid, ComposedChart, Line, Tooltip, XAxis, YAxis, ResponsiveContainer } from 'recharts';

import { formatMoney } from '@/features/members/components/detail/detail-ui';
import { useCurrencySymbol } from '@/lib/currency';
import type { PaymentAnalytics } from '../../types';
import { Chip, PanelCard, compactMoney, fmtDate, num } from './payments-ui';

const AXIS_TICK = { fill: 'var(--muted-foreground)', fontSize: 11 };
type Mode = 'daily' | 'weekly' | 'cumulative';

interface Point {
  label: string;
  tip: string;
  current: number;
  previous: number;
  refundMark: number | null;
}

function buildSeries(daily: PaymentAnalytics['daily'], mode: Mode): Point[] {
  if (mode === 'weekly') {
    const out: Point[] = [];
    for (let i = 0; i < daily.length; i += 7) {
      const chunk = daily.slice(i, i + 7);
      out.push({
        label: `Wk ${i / 7 + 1}`,
        tip: `${fmtDate(chunk[0]!.date)} – ${fmtDate(chunk[chunk.length - 1]!.date)}`,
        current: chunk.reduce((s, d) => s + num(d.collected), 0),
        previous: chunk.reduce((s, d) => s + num(d.previousCollected), 0),
        refundMark: chunk.some((d) => num(d.refunded) > 0) ? 0 : null,
      });
    }
    return out;
  }
  let cur = 0;
  let prev = 0;
  return daily.map((d) => {
    cur += num(d.collected);
    prev += num(d.previousCollected);
    return {
      label: fmtDate(d.date),
      tip: fmtDate(d.date, { weekday: 'short', day: 'numeric', month: 'short' }),
      current: mode === 'cumulative' ? cur : num(d.collected),
      previous: mode === 'cumulative' ? prev : num(d.previousCollected),
      refundMark: num(d.refunded) > 0 ? 0 : null,
    };
  });
}

export function CollectionsChart({ analytics, loading, error, compare, previousLabel }: { analytics?: PaymentAnalytics; loading: boolean; error: boolean; compare: boolean; previousLabel: string }) {
  const sym = useCurrencySymbol();
  const [mode, setMode] = React.useState<Mode>('daily');
  const data = React.useMemo(() => (analytics ? buildSeries(analytics.daily, mode) : []), [analytics, mode]);
  const empty = !!analytics && analytics.daily.every((d) => num(d.collected) === 0 && num(d.previousCollected) === 0);

  return (
    <PanelCard
      title="Collections over time"
      subtitle={`Successful payments, this period${compare ? ' vs previous period' : ''}`}
      loading={loading}
      error={error}
      skeletonHeight={290}
      className="flex-[2_1_640px]"
      action={
        <div className="flex gap-2">
          {(['daily', 'weekly', 'cumulative'] as Mode[]).map((m) => (
            <Chip key={m} small active={mode === m} onClick={() => setMode(m)}>
              {m[0]!.toUpperCase() + m.slice(1)}
            </Chip>
          ))}
        </div>
      }
    >
      {analytics ? (
        empty ? (
          <p className="flex h-[250px] items-center justify-center text-sm text-muted-foreground">No collections in this period yet.</p>
        ) : (
          <>
            <div className="mb-1 flex flex-wrap gap-[18px] text-[12.5px] font-bold text-foreground/80">
              <span className="inline-flex items-center gap-[7px]">
                <span className="h-1 w-3.5 rounded-sm" style={{ background: 'var(--chart-1)' }} />
                This period · {formatMoney(sym, analytics.kpis.collected.value)}
              </span>
              {compare ? (
                <span className="inline-flex items-center gap-[7px]">
                  <span className="w-3.5 border-t-[3px] border-dashed" style={{ borderColor: 'var(--muted-foreground)' }} />
                  {previousLabel} · {formatMoney(sym, analytics.kpis.collected.previous)}
                </span>
              ) : null}
              <span className="inline-flex items-center gap-[7px]">
                <span className="size-2.5 rounded-[3px]" style={{ background: 'var(--chart-5)' }} />
                Refund days
              </span>
            </div>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="payCollGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0" stopColor="var(--chart-1)" stopOpacity={0.28} />
                      <stop offset="1" stopColor="var(--chart-1)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={false} minTickGap={24} />
                  <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} width={52} tickFormatter={(v: number) => compactMoney(sym, v)} />
                  <Tooltip
                    contentStyle={{ background: 'var(--popover)', color: 'var(--popover-foreground)', border: '1px solid var(--border)', borderRadius: 12, fontSize: 12 }}
                    cursor={{ stroke: 'var(--border)' }}
                    labelFormatter={(_l, payload) => (payload?.[0]?.payload as Point | undefined)?.tip ?? ''}
                    formatter={(value: number, name: string) => [formatMoney(sym, value), name]}
                  />
                  {compare ? <Line type="monotone" dataKey="previous" name={previousLabel} stroke="var(--muted-foreground)" strokeWidth={2.2} strokeDasharray="6 6" dot={false} legendType="none" /> : null}
                  <Area type="monotone" dataKey="current" name="This period" stroke="var(--chart-1)" strokeWidth={3} fill="url(#payCollGrad)" dot={false} activeDot={{ r: 5 }} />
                  <Line dataKey="refundMark" name="Refund day" stroke="none" dot={{ r: 3.5, fill: 'var(--chart-5)', stroke: 'none' }} activeDot={false} isAnimationActive={false} connectNulls={false} legendType="none" tooltipType="none" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </>
        )
      ) : null}
    </PanelCard>
  );
}
