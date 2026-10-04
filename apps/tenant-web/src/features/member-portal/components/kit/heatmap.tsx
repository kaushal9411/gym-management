'use client';

import * as React from 'react';
import { motion } from 'framer-motion';

import { cn } from '@/lib/utils';
import { useMotionSafe } from '@/features/reports/lib/motion';
import { localDateKey } from '../../lib/format';
import { toneColor, type PortalTone } from './tones';

const ROWS = ['Mon', '', 'Wed', '', 'Fri', '', 'Sun'];

/**
 * Calendar heatmap (weeks as columns, Mon-Sun rows) of `{date: 'YYYY-MM-DD', value}`.
 * Fills missing days with 0, ends on the current week. `weeks` default 12.
 * Cells are square, fluid width (no horizontal scroll at 360px), intensity =
 * tone colour mixed by value/max; each cell has a `title` tooltip. `unit` is
 * the tooltip noun ("visit").
 */
export function PortalHeatmap({ points, weeks = 12, tone = 'primary', unit = 'visit', className }: { points: { date: string; value: number }[]; weeks?: number; tone?: PortalTone; unit?: string; className?: string }) {
  const m = useMotionSafe();
  const { cols, max } = React.useMemo(() => {
    const by = new Map(points.map((p) => [p.date.slice(0, 10), p.value]));
    const today = new Date();
    const mondayOffset = (today.getDay() + 6) % 7;
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - mondayOffset - (weeks - 1) * 7);
    let mx = 0;
    const out = Array.from({ length: weeks }, (_, w) => {
      const first = new Date(start.getFullYear(), start.getMonth(), start.getDate() + w * 7);
      const cells = Array.from({ length: 7 }, (_, d) => {
        const day = new Date(first.getFullYear(), first.getMonth(), first.getDate() + d);
        const key = localDateKey(day);
        const value = by.get(key) ?? 0;
        mx = Math.max(mx, value);
        return { key, value, future: day.getTime() > today.getTime(), label: day.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }) };
      });
      return { label: first.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }), cells };
    });
    return { cols: out, max: mx };
  }, [points, weeks]);

  return (
    <div className={cn('min-w-0', className)}>
      <div className="flex gap-1.5">
        <div className="grid shrink-0 grid-rows-7 gap-[3px] pt-0 text-[10px] leading-none text-muted-foreground" aria-hidden>
          {ROWS.map((r, i) => (
            <span key={i} className="flex items-center">
              {r}
            </span>
          ))}
        </div>
        <div className="grid min-w-0 flex-1" style={{ gridTemplateColumns: `repeat(${weeks}, minmax(0, 1fr))`, gap: 3 }}>
          {cols.map((col, w) => (
            <div key={w} className="grid grid-rows-7 gap-[3px]">
              {col.cells.map((c, d) => (
                <motion.span
                  key={c.key}
                  title={c.future ? undefined : `${c.label}: ${c.value} ${unit}${c.value === 1 ? '' : 's'}`}
                  className="aspect-square w-full rounded-[4px]"
                  style={{
                    background: c.future ? 'transparent' : c.value === 0 ? 'color-mix(in oklab, var(--muted-foreground) 13%, transparent)' : `color-mix(in oklab, ${toneColor(tone)} ${Math.round(32 + (c.value / Math.max(max, 1)) * 68)}%, transparent)`,
                  }}
                  initial={m.reduce ? false : { opacity: 0, scale: 0.6 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.3, delay: Math.min(w * 0.025 + d * 0.01, 0.5) }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between pl-6 text-[10px] text-muted-foreground">
        <span>{cols[0]?.label}</span>
        <span className="flex items-center gap-1">
          Less
          {[0, 0.35, 0.65, 1].map((f, i) => (
            <span key={i} className="size-2.5 rounded-[3px]" style={{ background: f === 0 ? 'color-mix(in oklab, var(--muted-foreground) 13%, transparent)' : `color-mix(in oklab, ${toneColor(tone)} ${Math.round(32 + f * 68)}%, transparent)` }} />
          ))}
          More
        </span>
        <span>{cols[cols.length - 1]?.label}</span>
      </div>
    </div>
  );
}

/** Horizontal weekday bars; `values` indexed Mon..Sun (7 numbers). The busiest day is highlighted and named in the caption. */
export function WeekdayBars({ values, tone = 'primary' }: { values: number[]; tone?: PortalTone }) {
  const m = useMotionSafe();
  const names = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const max = Math.max(...values, 0);
  const best = max > 0 ? values.indexOf(max) : -1;
  return (
    <div className="space-y-1.5">
      {values.map((v, i) => (
        <div key={names[i]} className="flex items-center gap-2 text-xs">
          <span className={cn('w-8 shrink-0 text-muted-foreground', i === best && 'font-semibold text-foreground')}>{names[i]}</span>
          <div className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
            <motion.div
              className="h-full rounded-full"
              style={{ width: `${max ? (v / max) * 100 : 0}%`, background: toneColor(tone), opacity: i === best ? 1 : 0.5, transformOrigin: 'left' }}
              initial={m.reduce ? false : { scaleX: 0 }}
              whileInView={{ scaleX: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: i * 0.05 }}
            />
          </div>
          <span className="w-6 shrink-0 text-right tabular-nums">{v}</span>
        </div>
      ))}
    </div>
  );
}
