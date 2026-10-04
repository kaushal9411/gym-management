'use client';

import { motion, useReducedMotion } from 'framer-motion';

import { useValueFormatter, type ValueFormat } from '../lib/format';
import { staggerDelay, EASE } from '../lib/motion';
import { PREVIOUS_COLOR } from '../lib/reports-theme';
import { ChartEmpty } from './chart-shared';

export interface HBarDatum {
  label: string;
  value: number;
  previous?: number;
  /** Small right-aligned note under the label (e.g. a branch name). */
  hint?: string;
}

/** Ranked horizontal bars (pure CSS/framer, width-responsive) with value labels and a tick marking `previous`; sorts desc and caps at `limit`. */
export function HBarChart({ data, format = 'number', color = 'var(--chart-1)', limit = 8, sort = true, rankBadges }: { data: HBarDatum[]; format?: ValueFormat; color?: string; limit?: number; sort?: boolean; rankBadges?: boolean }) {
  const reduce = useReducedMotion();
  const fmt = useValueFormatter(format);
  const rows = (sort ? [...data].sort((a, b) => b.value - a.value) : data).slice(0, limit);
  const max = Math.max(1, ...rows.flatMap((r) => [r.value, r.previous ?? 0]));
  if (!rows.length || rows.every((r) => r.value === 0 && !r.previous)) return <ChartEmpty height={160} />;
  return (
    <ul className="space-y-3">
      {rows.map((r, i) => (
        <li key={r.label}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-[13px]">
            <span className="flex min-w-0 items-center gap-2 font-semibold">
              {rankBadges ? <span className="flex size-5 shrink-0 items-center justify-center rounded-md bg-muted text-[11px] font-extrabold text-muted-foreground">{i + 1}</span> : null}
              <span className="truncate">{r.label}</span>
              {r.hint ? <span className="truncate text-xs font-normal text-muted-foreground">{r.hint}</span> : null}
            </span>
            <span className="shrink-0 font-extrabold tabular-nums">{fmt(r.value, true)}</span>
          </div>
          <div className="relative h-2.5 overflow-hidden rounded-full" style={{ backgroundColor: 'color-mix(in oklch, var(--muted-foreground) 14%, transparent)' }}>
            <motion.div
              className="h-full rounded-full"
              style={{ backgroundImage: `linear-gradient(90deg, ${color}, color-mix(in oklch, ${color} 60%, white))`, width: reduce ? `${(r.value / max) * 100}%` : undefined }}
              initial={reduce ? false : { width: 0 }}
              whileInView={reduce ? undefined : { width: `${(r.value / max) * 100}%` }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: staggerDelay(i, 0.06), ease: EASE }}
            />
            {r.previous !== undefined ? <span className="absolute inset-y-0 w-0.5 rounded-full" style={{ left: `${(r.previous / max) * 100}%`, backgroundColor: PREVIOUS_COLOR }} title={`Previous: ${fmt(r.previous)}`} /> : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
