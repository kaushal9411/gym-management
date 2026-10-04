'use client';

import * as React from 'react';
import { BarChart3 } from 'lucide-react';

import { cn } from '@/lib/utils';

export const AXIS_TICK = { fill: 'var(--muted-foreground)', fontSize: 11 } as const;
export const GRID_STROKE = 'color-mix(in oklch, var(--border) 70%, transparent)';
export const ANIM_MS = 900;

/** One chart datum: `label` = axis text, `tip` = longer tooltip heading, `previous` = same slot in the previous period. */
export interface ChartPoint {
  label: string;
  value: number;
  previous?: number;
  tip?: string;
}

/** Strips characters that are invalid inside `url(#id)` from `useId()` output. */
export function useSvgId(prefix: string): string {
  const id = React.useId();
  return `${prefix}-${id.replace(/[^a-zA-Z0-9_-]/g, '')}`;
}

interface TooltipItem {
  name?: string | number;
  value?: number | string;
  color?: string;
  stroke?: string;
  fill?: string;
  dataKey?: string | number;
  payload?: { tip?: string; label?: string };
}

/** Shared recharts tooltip: `content={<ChartTooltip format={fmt} />}`; heading uses `payload.tip ?? label`. */
export function ChartTooltip({
  active,
  payload,
  label,
  format,
  hideZero,
}: {
  active?: boolean;
  payload?: TooltipItem[];
  label?: string | number;
  format: (n: number) => string;
  hideZero?: boolean;
}) {
  if (!active || !payload?.length) return null;
  const rows = payload.filter((p) => p.value !== undefined && p.value !== null && !(hideZero && Number(p.value) === 0));
  if (!rows.length) return null;
  const heading = payload[0]?.payload?.tip ?? label;
  return (
    <div className="min-w-[140px] rounded-xl border bg-popover/95 px-3 py-2 text-popover-foreground shadow-lg backdrop-blur">
      {heading !== undefined ? <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{heading}</p> : null}
      <ul className="space-y-0.5">
        {rows.map((r, i) => (
          <li key={`${r.dataKey ?? r.name}-${i}`} className="flex items-center justify-between gap-4 text-[13px]">
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              <span className="size-2 rounded-full" style={{ backgroundColor: r.color ?? r.stroke ?? r.fill }} aria-hidden />
              {r.name}
            </span>
            <span className="font-extrabold tabular-nums">{format(Number(r.value))}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export interface LegendItem {
  key: string;
  label: string;
  color: string;
  /** Dashed swatch (previous period). */
  dashed?: boolean;
  value?: string;
}

/** Shared HTML legend; pass `hidden` + `onToggle` to let users hide series by clicking. */
export function ChartLegend({ items, hidden, onToggle, className }: { items: LegendItem[]; hidden?: Set<string>; onToggle?: (key: string) => void; className?: string }) {
  return (
    <ul className={cn('flex flex-wrap items-center gap-x-4 gap-y-1', className)}>
      {items.map((it) => {
        const off = hidden?.has(it.key);
        const inner = (
          <>
            <span
              className="h-0 w-4 rounded-full border-t-[3px]"
              style={{ borderColor: it.color, borderStyle: it.dashed ? 'dashed' : 'solid', opacity: off ? 0.3 : 1 }}
              aria-hidden
            />
            <span className={cn('text-xs font-semibold', off ? 'text-muted-foreground/60 line-through' : 'text-muted-foreground')}>{it.label}</span>
            {it.value ? <span className="text-xs font-extrabold tabular-nums">{it.value}</span> : null}
          </>
        );
        return (
          <li key={it.key}>
            {onToggle ? (
              <button type="button" aria-pressed={!off} onClick={() => onToggle(it.key)} className="inline-flex items-center gap-1.5 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                {inner}
              </button>
            ) : (
              <span className="inline-flex items-center gap-1.5">{inner}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** In-chart "no data" placeholder with the chart's min height preserved. */
export function ChartEmpty({ height = 240, message = 'No data for this period' }: { height?: number; message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed text-sm text-muted-foreground" style={{ minHeight: height }}>
      <BarChart3 className="size-5 opacity-60" aria-hidden />
      {message}
    </div>
  );
}

export const hasSignal = (values: Array<number | undefined>): boolean => values.some((v) => (v ?? 0) !== 0);
