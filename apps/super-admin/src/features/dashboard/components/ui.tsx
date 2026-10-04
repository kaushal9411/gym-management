'use client';

import { useEffect, useRef, useState } from 'react';
import { animate, motion, useReducedMotion } from 'framer-motion';

import { cn } from '@/lib/utils';
import { avatarColor, initials } from './format';

/** White card with a title row — the building block of every dashboard panel. Fades in on mount (<=250 ms). */
export function Panel({
  title, hint, right, className, bodyClassName, index = 0, children, as: Tag = 'section',
}: {
  title: string;
  hint?: React.ReactNode;
  right?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  index?: number;
  children: React.ReactNode;
  as?: 'section' | 'div';
}) {
  const reduce = useReducedMotion();
  const Comp = motion[Tag];
  return (
    <Comp
      aria-label={title}
      initial={reduce ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, delay: reduce ? 0 : Math.min(index, 8) * 0.03, ease: 'easeOut' }}
      className={cn('min-w-0 rounded-[14px] border bg-card text-card-foreground', className)}
    >
      <header className="flex items-center gap-2 px-4 pt-3.5">
        <h2 className="text-sm font-semibold">{title}</h2>
        {hint ? <span className="text-xs font-medium text-muted-foreground">{hint}</span> : null}
        {right ? <div className="ml-auto">{right}</div> : null}
      </header>
      <div className={cn('px-4 pb-4 pt-3', bodyClassName)}>{children}</div>
    </Comp>
  );
}

export type ChipTone = 'green' | 'amber' | 'red' | 'blue' | 'violet' | 'slate';
const CHIP: Record<ChipTone, string> = {
  green: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300',
  amber: 'bg-amber-100 text-amber-900 dark:bg-amber-500/15 dark:text-amber-300',
  red: 'bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300',
  blue: 'bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-300',
  violet: 'bg-violet-100 text-violet-800 dark:bg-violet-500/15 dark:text-violet-300',
  slate: 'bg-slate-200 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300',
};
export function Chip({ tone, children, className }: { tone: ChipTone; children: React.ReactNode; className?: string }) {
  return <span className={cn('inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold', CHIP[tone], className)}>{children}</span>;
}

export function Avatar({ name, seed, color }: { name: string; seed?: string; color?: string }) {
  return (
    <span className="grid size-[30px] shrink-0 place-items-center rounded-lg text-[11px] font-bold text-white" style={{ background: color ?? avatarColor(seed ?? name) }} aria-hidden>
      {initials(name)}
    </span>
  );
}

export function EmptyNote({ children }: { children: React.ReactNode }) {
  return <p className="rounded-lg border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">{children}</p>;
}

/** Thin progress bar. */
export function Bar({ pct, color, height = 6 }: { pct: number; color: string; height?: number }) {
  return (
    <div className="overflow-hidden rounded-full bg-muted" style={{ height }} role="presentation">
      <div className="h-full rounded-full transition-[width] duration-300" style={{ width: `${Math.max(0, Math.min(100, pct))}%`, background: color }} />
    </div>
  );
}

/** Segmented control (radio semantics). */
export function Segmented<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: Array<{ value: T; label: string; disabled?: boolean }>; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-[10px] bg-secondary p-[3px]">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={o.disabled}
            onClick={() => onChange(o.value)}
            className={cn(
              'rounded-[7px] px-3 py-1 text-[12.5px] font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40',
              on ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Animated number. Skips animation under reduced motion; the final string is always what's rendered at rest. */
export function CountUp({ value, format }: { value: number; format: (v: number) => string }) {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(value);
  const prev = useRef(value);
  const first = useRef(true);
  useEffect(() => {
    if (reduce) { setShown(value); prev.current = value; return; }
    const from = first.current ? 0 : prev.current;
    first.current = false;
    const c = animate(from, value, { duration: 0.6, ease: 'easeOut', onUpdate: (v) => setShown(v) });
    prev.current = value;
    return () => c.stop();
  }, [value, reduce]);
  return <>{format(shown)}</>;
}

export function ChartTooltip({ active, payload, label, fmt, names }: {
  active?: boolean;
  payload?: Array<{ value?: number | string; color?: string; dataKey?: string | number; name?: string }>;
  label?: string;
  fmt: (v: number) => string;
  names?: Record<string, string>;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg bg-slate-900 px-3 py-2 text-xs text-white shadow-lg">
      <p className="mb-1 text-slate-300">{label}</p>
      {payload.map((p) => (
        <p key={String(p.dataKey)} className="flex items-center gap-2 font-semibold">
          <i className="size-2 rounded-sm" style={{ background: p.color }} />
          {names?.[String(p.dataKey)] ?? p.name}: {p.value === null || p.value === undefined ? '—' : fmt(Number(p.value))}
        </p>
      ))}
    </div>
  );
}
