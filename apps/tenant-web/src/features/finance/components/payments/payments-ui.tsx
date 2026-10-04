'use client';

import * as React from 'react';

import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/** Rounded white-card shell used by every panel on the Payments pages (title + subtitle + optional right slot). */
export function PanelCard({
  title,
  subtitle,
  action,
  loading,
  error,
  skeletonHeight = 180,
  className,
  children,
}: {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  loading?: boolean;
  /** Analytics endpoint unavailable → compact message instead of the body. */
  error?: boolean;
  skeletonHeight?: number;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <section className={cn('min-w-0 rounded-[20px] border bg-card p-5 text-card-foreground shadow-xs sm:p-[22px]', className)}>
      {title ? (
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-[17px] font-extrabold leading-tight">{title}</h2>
            {subtitle ? <p className="mt-0.5 text-[13px] text-muted-foreground">{subtitle}</p> : null}
          </div>
          {action}
        </div>
      ) : null}
      {loading ? (
        <Skeleton className="w-full rounded-xl" style={{ height: skeletonHeight }} />
      ) : error ? (
        <p className="flex items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground" style={{ minHeight: Math.min(skeletonHeight, 120) }}>
          Analytics unavailable right now.
        </p>
      ) : (
        children
      )}
    </section>
  );
}

export function Chip({
  active,
  onClick,
  children,
  small,
  dotColor,
  className,
  ...rest
}: {
  active?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  small?: boolean;
  dotColor?: string;
  className?: string;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onClick' | 'children'>) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        small ? 'h-[30px] px-3 text-xs' : 'h-[34px] px-3.5 text-[13px]',
        active ? 'border-primary bg-primary text-primary-foreground' : 'border-input bg-card text-foreground/80 hover:bg-accent',
        className,
      )}
      {...rest}
    >
      {dotColor ? <span className="size-2 rounded-full" style={{ backgroundColor: dotColor }} aria-hidden /> : null}
      {children}
    </button>
  );
}

export function FieldLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn('text-xs font-bold uppercase tracking-wider text-muted-foreground', className)}>{children}</span>;
}

/** Token-colored SVG ring (Payment methods / Refund split) — segments are `{value, color}`; centre content is passed as children. */
export function Donut({ segments, size = 168, children }: { segments: { value: number; color: string; label?: string }[]; size?: number; children?: React.ReactNode }) {
  const r = 54;
  const c = 2 * Math.PI * r;
  const total = segments.reduce((s, x) => s + Math.max(x.value, 0), 0);
  let offset = 0;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 140 140" width={size} height={size} role="img" aria-label="Distribution">
        <g fill="none" strokeWidth={20} transform="rotate(-90 70 70)">
          <circle cx="70" cy="70" r={r} stroke="var(--muted)" />
          {total > 0
            ? segments.map((seg, i) => {
                const len = (Math.max(seg.value, 0) / total) * c;
                const el = <circle key={i} cx="70" cy="70" r={r} stroke={seg.color} strokeDasharray={`${len} ${c}`} strokeDashoffset={-offset} />;
                offset += len;
                return el;
              })
            : null}
        </g>
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  );
}

/** Tiny polyline sparkline (viewBox-stretched) from a numeric series. */
export function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return <div className="mt-2.5 h-[34px]" />;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * 120},${30 - ((v - min) / span) * 26}`).join(' ');
  return (
    <svg viewBox="0 0 120 34" width="100%" height="34" preserveAspectRatio="none" className="mt-2.5 block" aria-hidden>
      <polyline fill="none" stroke={color} strokeWidth="2.4" strokeLinejoin="round" vectorEffect="non-scaling-stroke" points={pts} />
    </svg>
  );
}

// ── pure helpers ──────────────────────────────────────────────────────────

export const num = (v: string | number | null | undefined): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** % change vs previous; `null` when there's no baseline to compare with. */
export function pctChange(value: number, previous: number): number | null {
  if (previous <= 0) return value > 0 ? null : 0;
  return ((value - previous) / previous) * 100;
}

/** Compact money for tight spots (donut centre, axis ticks): 4.82L / 12.4k. */
export function compactMoney(symbol: string, n: number): string {
  const abs = Math.abs(n);
  if (abs >= 10_000_000) return `${symbol}${(n / 10_000_000).toFixed(2)}Cr`;
  if (abs >= 100_000) return `${symbol}${(n / 100_000).toFixed(2)}L`;
  if (abs >= 1_000) return `${symbol}${(n / 1_000).toFixed(1).replace(/\.0$/, '')}k`;
  return `${symbol}${Math.round(n)}`;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

const AVATAR_TOKENS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-7)', 'var(--chart-5)', 'var(--chart-8)'];
export function avatarColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_TOKENS[h % AVATAR_TOKENS.length]!;
}

export function MemberAvatar({ name, seed, size = 34 }: { name: string; seed?: string; size?: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full text-xs font-extrabold text-white"
      style={{ width: size, height: size, backgroundColor: avatarColor(seed ?? name), fontSize: size > 40 ? 15 : 12 }}
    >
      {initials(name)}
    </span>
  );
}

export function DeltaText({ pct, goodWhenDown, suffix }: { pct: number | null; goodWhenDown?: boolean; suffix?: React.ReactNode }) {
  if (pct === null) return <span className="text-xs font-semibold text-muted-foreground">{suffix}</span>;
  const up = pct >= 0;
  const good = goodWhenDown ? !up : up;
  return (
    <span className="text-[12.5px] font-bold" style={{ color: pct === 0 ? 'var(--muted-foreground)' : good ? 'var(--success)' : 'var(--destructive)' }}>
      {up ? '▲' : '▼'} {Math.abs(pct).toFixed(1)}% {suffix ? <span className="font-semibold text-muted-foreground">{suffix}</span> : null}
    </span>
  );
}

export function fmtDate(iso: string, opts?: Intl.DateTimeFormatOptions): string {
  return new Date(iso).toLocaleDateString(undefined, opts ?? { day: 'numeric', month: 'short' });
}

export function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}, ${d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false })}`;
}
