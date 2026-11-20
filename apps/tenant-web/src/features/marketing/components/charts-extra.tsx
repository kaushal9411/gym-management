'use client';

/** More illustration charts: funnel, horizontal bars, grouped bars and multi-line. Same rules as `charts.tsx`. */
import * as React from 'react';
import { motion, useReducedMotion } from 'framer-motion';

import { smoothPath, useSeen } from './charts';

const EASE = [0.22, 1, 0.36, 1] as const;

/** A funnel drawn as shrinking bars with the step-to-step drop shown between them. */
export function FunnelChart({ steps }: { steps: Array<{ label: string; value: number; className: string }> }) {
  const reduce = useReducedMotion();
  const ref = React.useRef<HTMLOListElement>(null);
  const seen = useSeen(ref);
  const top = steps[0]!.value;
  return (
    <ol ref={ref} className="space-y-2" aria-label="Lead funnel (sample data)">
      {steps.map((s, i) => {
        const pct = (s.value / top) * 100;
        const prev = steps[i - 1];
        const kept = prev ? Math.round((s.value / prev.value) * 100) : null;
        return (
          <li key={s.label} className="grid grid-cols-[6.5rem_1fr_auto] items-center gap-3 text-xs">
            <span className="truncate font-medium text-foreground/70">{s.label}</span>
            <div className="h-7 rounded-lg bg-foreground/[0.06]">
              <motion.div
                className={`flex h-full items-center justify-end rounded-lg pr-2 text-[11px] font-bold text-[#1a0f08] ${s.className}`}
                initial={reduce ? false : { width: 0 }}
                animate={{ width: seen ? `${Math.max(pct, 9)}%` : 0 }}
                transition={{ duration: 0.9, delay: i * 0.1, ease: EASE }}
              >
                {s.value}
              </motion.div>
            </div>
            <span className="w-10 text-right tabular-nums text-foreground/45">{kept === null ? '' : `${kept}%`}</span>
          </li>
        );
      })}
    </ol>
  );
}

/** Horizontal bars with a label and value, for rankings (sources, branches, classes). */
export function HBars({ rows, unit = '' }: { rows: Array<{ label: string; value: number; className: string }>; unit?: string }) {
  const reduce = useReducedMotion();
  const ref = React.useRef<HTMLUListElement>(null);
  const seen = useSeen(ref);
  const max = Math.max(...rows.map((r) => r.value));
  return (
    <ul ref={ref} className="space-y-2.5" aria-label="Ranking (sample data)">
      {rows.map((r, i) => (
        <li key={r.label}>
          <div className="mb-1 flex justify-between text-xs">
            <span className="font-medium text-foreground/70">{r.label}</span>
            <span className="tabular-nums font-semibold text-foreground">{r.value}{unit}</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-foreground/10">
            <motion.div
              className={`h-full rounded-full ${r.className}`}
              initial={reduce ? false : { width: 0 }}
              animate={{ width: seen ? `${(r.value / max) * 100}%` : 0 }}
              transition={{ duration: 0.9, delay: i * 0.08, ease: EASE }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Two bars per category side by side (for example revenue next to expenses). */
export function GroupedBars({
  labels,
  a,
  b,
  height = 130,
}: {
  labels: string[];
  a: { name: string; values: number[]; className: string };
  b: { name: string; values: number[]; className: string };
  height?: number;
}) {
  const reduce = useReducedMotion();
  const ref = React.useRef<SVGSVGElement>(null);
  const seen = useSeen(ref);
  const W = 360;
  const H = height;
  const max = Math.max(...a.values, ...b.values);
  const group = (W - 16) / labels.length;
  const bw = Math.min(16, (group - 10) / 2);
  const bar = (v: number) => Math.max(3, (v / max) * (H - 26));
  return (
    <div>
      <svg ref={ref} viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`${a.name} and ${b.name} by month (sample data)`}>
        {[0.33, 0.66].map((g) => (
          <line key={g} x1={8} x2={W - 8} y1={(H - 18) * g} y2={(H - 18) * g} className="stroke-foreground/10" strokeDasharray="3 5" />
        ))}
        {labels.map((l, i) => {
          const cx = 8 + group * i + group / 2;
          return (
            <g key={l}>
              {[
                { v: a.values[i]!, x: cx - bw - 1, cls: a.className },
                { v: b.values[i]!, x: cx + 1, cls: b.className },
              ].map((r, j) => (
                <motion.rect
                  key={j}
                  x={r.x}
                  y={H - 16 - bar(r.v)}
                  width={bw}
                  height={bar(r.v)}
                  rx={3}
                  className={r.cls}
                  fill="currentColor"
                  initial={reduce ? false : { scaleY: 0 }}
                  animate={{ scaleY: seen ? 1 : 0 }}
                  transition={{ duration: 0.8, delay: i * 0.07 + j * 0.05, ease: EASE }}
                  style={{ transformBox: 'fill-box', transformOrigin: 'bottom' }}
                />
              ))}
              <text x={cx} y={H - 3} textAnchor="middle" className="fill-foreground/45 text-[9px]">{l}</text>
            </g>
          );
        })}
      </svg>
      <div className="mt-1 flex gap-4 text-[11px] text-foreground/60">
        {[a, b].map((s) => (
          <span key={s.name} className="flex items-center gap-1.5"><span className={`size-2 rounded-sm bg-current ${s.className}`} />{s.name}</span>
        ))}
      </div>
    </div>
  );
}

/** Two or more lines on one scale, each drawing itself in. */
export function MultiLine({
  series,
  labels,
  height = 130,
}: {
  series: Array<{ name: string; values: number[]; className: string }>;
  labels: string[];
  height?: number;
}) {
  const reduce = useReducedMotion();
  const W = 360;
  const H = height;
  const pad = 10;
  const max = Math.max(...series.flatMap((s) => s.values)) * 1.1;
  const pts = (vals: number[]): Array<[number, number]> => vals.map((v, i) => [pad + (i * (W - pad * 2)) / (vals.length - 1), H - 18 - (v / max) * (H - 30)]);
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Trend lines (sample data)">
        {[0.25, 0.5, 0.75].map((g) => (
          <line key={g} x1={pad} x2={W - pad} y1={(H - 18) * g} y2={(H - 18) * g} className="stroke-foreground/10" strokeDasharray="3 5" />
        ))}
        {series.map((s, si) => {
          const p = pts(s.values);
          const last = p[p.length - 1]!;
          return (
            <g key={s.name} className={s.className}>
              <motion.path
                d={smoothPath(p)}
                fill="none"
                stroke="currentColor"
                strokeWidth={2.5}
                strokeLinecap="round"
                initial={reduce ? false : { pathLength: 0 }}
                whileInView={{ pathLength: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 1.4, delay: si * 0.25, ease: EASE }}
              />
              <motion.circle
                cx={last[0]}
                cy={last[1]}
                r={4}
                fill="currentColor"
                className="stroke-background"
                strokeWidth={2}
                initial={reduce ? false : { scale: 0 }}
                whileInView={{ scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 1.3 + si * 0.25, type: 'spring', stiffness: 260, damping: 14 }}
                style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
              />
            </g>
          );
        })}
        {labels.map((l, i) => (
          <text key={l + i} x={pad + (i * (W - pad * 2)) / (labels.length - 1)} y={H - 3} textAnchor={i === 0 ? 'start' : i === labels.length - 1 ? 'end' : 'middle'} className="fill-foreground/45 text-[9px]">{l}</text>
        ))}
      </svg>
      <div className="mt-1 flex gap-4 text-[11px] text-foreground/60">
        {series.map((s) => (
          <span key={s.name} className={`flex items-center gap-1.5 ${''}`}><span className={`h-0.5 w-4 rounded-full bg-current ${s.className}`} />{s.name}</span>
        ))}
      </div>
    </div>
  );
}
