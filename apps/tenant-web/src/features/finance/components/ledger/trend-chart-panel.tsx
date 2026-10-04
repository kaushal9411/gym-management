'use client';

import * as React from 'react';
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { formatMoney } from '@/features/members/components/detail/detail-ui';
import { useCurrencySymbol } from '@/lib/currency';
import type { LedgerAnalytics } from '../../types';
import { Chip, PanelCard, compactMoney, fmtDate, num } from '../payments/payments-ui';
import type { PanelProps } from './ledger-theme';

const AXIS_TICK = { fill: 'var(--muted-foreground)', fontSize: 11 };
type Mode = 'daily' | 'weekly' | 'cumulative';
interface Point {
  label: string;
  tip: string;
  current: number;
  previous: number;
}

function buildSeries(daily: LedgerAnalytics['daily'], mode: Mode): Point[] {
  if (mode === 'weekly') {
    const out: Point[] = [];
    for (let i = 0; i < daily.length; i += 7) {
      const chunk = daily.slice(i, i + 7);
      out.push({
        label: `Wk ${i / 7 + 1}`,
        tip: `${fmtDate(chunk[0]!.date)} – ${fmtDate(chunk[chunk.length - 1]!.date)}`,
        current: chunk.reduce((s, d) => s + num(d.total), 0),
        previous: chunk.reduce((s, d) => s + num(d.previousTotal), 0),
      });
    }
    return out;
  }
  let cur = 0;
  let prev = 0;
  return daily.map((d) => {
    cur += num(d.total);
    prev += num(d.previousTotal);
    return {
      label: fmtDate(d.date),
      tip: fmtDate(d.date, { weekday: 'short', day: 'numeric', month: 'short' }),
      current: mode === 'cumulative' ? cur : num(d.total),
      previous: mode === 'cumulative' ? prev : num(d.previousTotal),
    };
  });
}

/** Daily / Weekly / Cumulative this-vs-previous area chart (all derived client-side from `analytics.daily`). */
export function TrendChartPanel({ analytics, loading, error, theme, compare, previousLabel }: PanelProps & { compare: boolean; previousLabel: string }) {
  const sym = useCurrencySymbol();
  const [mode, setMode] = React.useState<Mode>('daily');
  const data = React.useMemo(() => (analytics ? buildSeries(analytics.daily, mode) : []), [analytics, mode]);
  const empty = !!analytics && analytics.daily.every((d) => num(d.total) === 0 && num(d.previousTotal) === 0);
  const gradId = `ledgerGrad-${theme.kind}`;
  const Noun = theme.noun[0]!.toUpperCase() + theme.noun.slice(1);

  return (
    <PanelCard
      title={`${Noun} over time`}
      subtitle={`Recorded ${theme.noun}, this period${compare ? ' vs previous period' : ''}`}
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
          <p className="flex h-[250px] items-center justify-center text-sm text-muted-foreground">No {theme.nounPlural} in this period yet.</p>
        ) : (
          <>
            <div className="mb-1 flex flex-wrap gap-[18px] text-[12.5px] font-bold text-foreground/80">
              <span className="inline-flex items-center gap-[7px]">
                <span className="h-1 w-3.5 rounded-sm" style={{ background: theme.accent }} />
                This period · {formatMoney(sym, analytics.kpis.total.value)}
              </span>
              {compare ? (
                <span className="inline-flex items-center gap-[7px]">
                  <span className="w-3.5 border-t-[3px] border-dashed" style={{ borderColor: 'var(--muted-foreground)' }} />
                  {previousLabel} · {formatMoney(sym, analytics.kpis.total.previous)}
                </span>
              ) : null}
            </div>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0" stopColor={theme.accent} stopOpacity={0.28} />
                      <stop offset="1" stopColor={theme.accent} stopOpacity={0} />
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
                  <Area type="monotone" dataKey="current" name="This period" stroke={theme.accent} strokeWidth={3} fill={`url(#${gradId})`} dot={false} activeDot={{ r: 5 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </>
        )
      ) : null}
    </PanelCard>
  );
}
