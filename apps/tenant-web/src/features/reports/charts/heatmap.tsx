'use client';

import { motion } from 'framer-motion';

import { cn } from '@/lib/utils';
import { useValueFormatter, type ValueFormat } from '../lib/format';
import { useMotionSafe } from '../lib/motion';
import { ChartEmpty } from './chart-shared';

/** `{date,value}` → weekday-rows × week-columns matrix (calendar-style). */
export function calendarMatrix(points: { date: string; value: number }[]): { rows: string[]; cols: string[]; values: number[][]; titles: string[][] } {
  const rows = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  if (!points.length) return { rows, cols: [], values: rows.map(() => []), titles: rows.map(() => []) };
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
  const parse = (s: string) => new Date(`${s.slice(0, 10)}T00:00:00`);
  const first = parse(sorted[0]!.date);
  const offset = (first.getDay() + 6) % 7;
  const start = new Date(first.getFullYear(), first.getMonth(), first.getDate() - offset);
  const byDate = new Map(sorted.map((p) => [p.date.slice(0, 10), p.value]));
  const last = parse(sorted[sorted.length - 1]!.date);
  const weeks = Math.floor((last.getTime() - start.getTime()) / 86_400_000 / 7) + 1;
  const values = rows.map(() => Array<number>(weeks).fill(0));
  const titles = rows.map(() => Array<string>(weeks).fill(''));
  const cols: string[] = [];
  for (let w = 0; w < weeks; w++) {
    const wk = new Date(start.getFullYear(), start.getMonth(), start.getDate() + w * 7);
    cols.push(wk.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }));
    for (let d = 0; d < 7; d++) {
      const day = new Date(wk.getFullYear(), wk.getMonth(), wk.getDate() + d);
      const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
      values[d]![w] = byDate.get(key) ?? 0;
      titles[d]![w] = day.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
    }
  }
  return { rows, cols, values, titles };
}

/** Intensity grid (pure CSS grid, staggered fade-in): `values[row][col]`; use `calendarMatrix` for dated data or a 1-row matrix for hours. */
export function Heatmap({
  rows,
  cols,
  values,
  titles,
  format = 'number',
  color = 'var(--chart-2)',
  showColLabelEvery = 1,
  cellHeight = 28,
}: {
  rows: string[];
  cols: string[];
  values: number[][];
  /** Optional per-cell tooltip heading (same shape as `values`). */
  titles?: string[][];
  format?: ValueFormat;
  color?: string;
  /** Show every Nth column label (e.g. 3 for 24 hours). */
  showColLabelEvery?: number;
  cellHeight?: number;
}) {
  const m = useMotionSafe();
  const fmt = useValueFormatter(format);
  const max = Math.max(0, ...values.flat());
  if (!rows.length || !cols.length || max <= 0) return <ChartEmpty height={140} />;
  const cells = rows.length * cols.length;
  const step = Math.min(0.012, 0.7 / cells);
  const item = m.reduce
    ? m.fadeUp
    : { hidden: { opacity: 0, scale: 0.6 }, show: { opacity: 1, scale: 1, transition: { duration: 0.3 } } };

  return (
    <div>
      <motion.div
        className="grid gap-1"
        style={{ gridTemplateColumns: `auto repeat(${cols.length}, minmax(0, 1fr))` }}
        variants={m.staggerContainer(step, 0.05)}
        initial={m.initial}
        whileInView="show"
        viewport={{ once: true }}
        role="table"
        aria-label="Heatmap"
      >
        {rows.map((row, r) => (
          <div key={row} className="contents" role="row">
            <span className="flex items-center pr-2 text-[11px] font-semibold text-muted-foreground">{row}</span>
            {cols.map((col, c) => {
              const v = values[r]?.[c] ?? 0;
              const t = v / max;
              const tip = `${titles?.[r]?.[c] || `${row} · ${col}`}: ${fmt(v)}`;
              return (
                <motion.span
                  key={col + c}
                  variants={item}
                  title={tip}
                  aria-label={tip}
                  role="cell"
                  whileHover={m.reduce ? undefined : { scale: 1.18 }}
                  className={cn('rounded-[5px] ring-1 ring-inset ring-border/40', v === 0 && 'bg-muted/50')}
                  style={{ height: cellHeight, backgroundColor: v === 0 ? undefined : `color-mix(in oklch, ${color} ${Math.round(14 + t * 80)}%, transparent)` }}
                />
              );
            })}
          </div>
        ))}
        <span />
        {cols.map((col, c) => (
          <span key={col + c} className="truncate text-center text-[10px] font-semibold text-muted-foreground">
            {c % showColLabelEvery === 0 ? col : ''}
          </span>
        ))}
      </motion.div>
      <div className="mt-3 flex items-center justify-end gap-1.5 text-[11px] font-semibold text-muted-foreground">
        Less
        {[0.15, 0.35, 0.55, 0.8, 1].map((t) => (
          <span key={t} className="size-3.5 rounded-[4px]" style={{ backgroundColor: `color-mix(in oklch, ${color} ${Math.round(14 + t * 80)}%, transparent)` }} aria-hidden />
        ))}
        More
      </div>
    </div>
  );
}
