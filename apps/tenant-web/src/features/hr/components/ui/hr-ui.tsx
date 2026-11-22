'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowLeft, ChevronLeft, ChevronRight, CircleAlert, RefreshCw } from 'lucide-react';
import { animate, AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';

import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { EmptyState as KitEmptyState } from '@/features/reports/components/ui';
import { EASE, useMotionSafe } from '@/features/reports/lib/motion';
import { HR_AVATAR_GRADIENTS, HR_HERO_BG, HR_INK, mix, TONES, type HrTone } from '../../lib/hr-palette';
import { addMonths, formatMonth } from '../../lib/dates';

export { Reveal, StaggerGroup, StaggerItem } from '@/features/reports/components/ui';
/** Count-up number (own copy of the reports one that does not read the gym's currency settings, so staff without settings access never trigger a 403). Default format uses Indian digit grouping. */
export function AnimatedNumber({ value, format, duration = 0.9, className }: { value: number; format?: (n: number) => string; duration?: number; className?: string }) {
  const reduce = useReducedMotion();
  const fmtRef = React.useRef<(n: number) => string>((n) => Math.round(n).toLocaleString('en-IN'));
  fmtRef.current = format ?? ((n: number) => Math.round(n).toLocaleString('en-IN'));
  const ref = React.useRef<HTMLSpanElement>(null);
  const from = React.useRef(0);
  React.useEffect(() => {
    const el = ref.current;
    if (reduce || !el) {
      from.current = value;
      return;
    }
    const controls = animate(from.current, value, {
      duration,
      ease: [0.2, 0.8, 0.2, 1],
      onUpdate: (v) => {
        el.textContent = fmtRef.current(v);
      },
      onComplete: () => {
        from.current = value;
      },
    });
    return () => {
      controls.stop();
      from.current = value;
    };
  }, [value, reduce, duration]);
  return (
    <span ref={ref} className={className}>
      {fmtRef.current(value)}
    </span>
  );
}

// ── Hero ───────────────────────────────────────────────────────────────

export interface HrHeroStat {
  label: string;
  value: React.ReactNode;
}

export function HrHero({
  eyebrow,
  title,
  subtitle,
  icon: Icon,
  backHref,
  backLabel = 'Back',
  stats,
  actions,
  aside,
}: {
  eyebrow: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: LucideIcon;
  backHref?: string;
  backLabel?: string;
  stats?: HrHeroStat[];
  actions?: React.ReactNode;
  aside?: React.ReactNode;
}) {
  const m = useMotionSafe();
  return (
    <motion.section
      initial={m.reduce ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE }}
      className="relative overflow-hidden rounded-[28px] px-5 py-6 text-white shadow-lg sm:px-8 sm:py-8 lg:px-10"
      style={{ backgroundImage: HR_HERO_BG }}
    >
      <div aria-hidden className="pointer-events-none absolute inset-0" style={{ backgroundImage: 'repeating-linear-gradient(135deg, rgba(255,255,255,.05) 0 2px, transparent 2px 14px)' }} />
      {m.reduce ? null : (
        <>
          <motion.div aria-hidden className="pointer-events-none absolute -right-16 -top-20 size-72 rounded-full bg-white/10 blur-2xl" animate={{ x: [0, -18, 0], y: [0, 14, 0] }} transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }} />
          <motion.div aria-hidden className="pointer-events-none absolute -bottom-24 left-1/3 size-60 rounded-full bg-teal-300/15 blur-3xl" animate={{ x: [0, 24, 0], y: [0, -10, 0] }} transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut' }} />
        </>
      )}
      <div className="relative flex flex-wrap items-end justify-between gap-5">
        <div className="min-w-[240px] flex-[1_1_420px]">
          {backHref ? (
            <Link href={backHref} className="inline-flex items-center gap-1.5 rounded text-[13px] font-bold text-white/85 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70">
              <ArrowLeft className="size-3.5" aria-hidden /> {backLabel}
            </Link>
          ) : null}
          <p className={cn('flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-[0.14em] text-white/80', backHref && 'mt-3')}>
            {Icon ? <Icon className="size-3.5" aria-hidden /> : null}
            {eyebrow}
          </p>
          <h1 className="my-1.5 text-[28px] font-extrabold leading-[1.08] sm:text-[38px]">{title}</h1>
          {subtitle ? <p className="max-w-[600px] text-[14.5px] leading-relaxed text-white/90">{subtitle}</p> : null}
          {stats ? (
            <motion.div className="mt-4 flex flex-wrap gap-x-7 gap-y-3" variants={m.staggerContainer(0.08, 0.2)} initial={m.initial} animate="show">
              {stats.map((s) => (
                <motion.div key={s.label} variants={m.fadeUp}>
                  <div className="text-[24px] font-extrabold tabular-nums leading-tight">{s.value}</div>
                  <div className="text-xs font-semibold text-white/80">{s.label}</div>
                </motion.div>
              ))}
            </motion.div>
          ) : null}
        </div>
        {aside ?? (actions ? <div className="flex flex-wrap gap-2.5">{actions}</div> : null)}
      </div>
    </motion.section>
  );
}

export function HeroButton({
  href,
  solid,
  className,
  children,
  ...rest
}: { href?: string; solid?: boolean; className?: string; children: React.ReactNode } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const cls = cn(
    'inline-flex h-11 items-center gap-2 whitespace-nowrap rounded-xl border px-[18px] text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 disabled:opacity-60',
    solid ? 'border-white bg-white hover:bg-white/90' : 'border-white/30 bg-white/15 text-white hover:bg-white/25',
    className,
  );
  if (href)
    return (
      <Link href={href} className={cls} style={solid ? { color: HR_INK } : undefined}>
        {children}
      </Link>
    );
  return (
    <button type="button" className={cls} style={solid ? { color: HR_INK } : undefined} {...rest}>
      {children}
    </button>
  );
}

// ── Panel ──────────────────────────────────────────────────────────────

export function HrPanel({
  title,
  subtitle,
  icon: Icon,
  tone,
  action,
  className,
  children,
  id,
}: {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: LucideIcon;
  tone?: string;
  action?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
  id?: string;
}) {
  const color = tone ?? 'var(--primary)';
  return (
    <section id={id} className={cn('relative min-w-0 overflow-hidden rounded-[20px] border bg-card p-4 text-card-foreground shadow-xs sm:p-5', className)}>
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-24" style={{ backgroundImage: `linear-gradient(180deg, ${mix(color, 9)}, transparent)` }} />
      {title ? (
        <div className="relative mb-3 flex flex-wrap items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2.5">
            {Icon ? (
              <span className="flex size-8 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: mix(color, 16), color }}>
                <Icon className="size-4" aria-hidden />
              </span>
            ) : null}
            <div className="min-w-0">
              <h2 className="truncate text-base font-extrabold leading-tight">{title}</h2>
              {subtitle ? <p className="mt-0.5 text-[12.5px] text-muted-foreground">{subtitle}</p> : null}
            </div>
          </div>
          {action}
        </div>
      ) : null}
      <div className="relative">{children}</div>
    </section>
  );
}

// ── KPI tile ───────────────────────────────────────────────────────────

export function HrKpi({
  label,
  value,
  icon: Icon,
  color = 'var(--primary)',
  hint,
  loading,
  format,
  href,
  pulse,
}: {
  label: string;
  value: number;
  icon: LucideIcon;
  color?: string;
  hint?: React.ReactNode;
  loading?: boolean;
  format?: (n: number) => string;
  href?: string;
  pulse?: boolean;
}) {
  const m = useMotionSafe();
  const body = (
    <motion.div
      variants={m.fadeUp}
      whileHover={m.reduce ? undefined : { y: -3 }}
      transition={{ type: 'spring', stiffness: 380, damping: 28 }}
      className="relative h-full min-w-0 overflow-hidden rounded-[20px] border bg-card p-4 shadow-xs transition-shadow hover:shadow-md"
    >
      <div aria-hidden className="pointer-events-none absolute inset-0" style={{ backgroundImage: `linear-gradient(135deg, ${mix(color, 16)}, transparent 70%)` }} />
      <div className="relative">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-bold uppercase leading-tight tracking-wider text-muted-foreground">{label}</p>
          <span className="relative flex size-8 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: mix(color, 18), color }}>
            {pulse && !m.reduce ? <span aria-hidden className="absolute inset-0 animate-ping rounded-lg opacity-40" style={{ backgroundColor: mix(color, 30) }} /> : null}
            <Icon className="relative size-4" aria-hidden />
          </span>
        </div>
        {loading ? (
          <Skeleton className="mt-3 h-8 w-20" />
        ) : (
          <p className="mt-2 text-[28px] font-extrabold leading-none tabular-nums">
            <AnimatedNumber value={value} format={format} />
          </p>
        )}
        {hint ? <div className="mt-1.5 min-h-4 text-xs text-muted-foreground">{hint}</div> : null}
      </div>
    </motion.div>
  );
  return href ? (
    <Link href={href} className="block rounded-[20px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      {body}
    </Link>
  ) : (
    body
  );
}

// ── Chips ──────────────────────────────────────────────────────────────

/** Status chip: tinted pill with icon + label; swapping `tone` morphs it (spring scale/fade). */
export function ToneChip({ tone, label, small, className }: { tone: HrTone; label?: string; small?: boolean; className?: string }) {
  const m = useMotionSafe();
  const meta = TONES[tone];
  const Icon = meta.icon;
  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.span
        key={tone + (label ?? '')}
        initial={m.reduce ? false : { opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={m.reduce ? undefined : { opacity: 0, scale: 0.85 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        className={cn('inline-flex items-center gap-1 whitespace-nowrap rounded-full font-bold', small ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs', className)}
        style={{ color: meta.color, backgroundColor: mix(meta.color, 14), boxShadow: `inset 0 0 0 1px ${mix(meta.color, 22)}` }}
      >
        <Icon className={small ? 'size-3' : 'size-3.5'} aria-hidden />
        {label ?? meta.label}
      </motion.span>
    </AnimatePresence>
  );
}

export function Pill({
  active,
  onClick,
  children,
  color,
  className,
  ...rest
}: { active?: boolean; onClick?: () => void; children: React.ReactNode; color?: string; className?: string } & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'>) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        active ? 'border-transparent text-white shadow-sm' : 'border-input bg-card text-foreground/80 hover:bg-accent',
        className,
      )}
      style={active ? { backgroundColor: color ?? 'var(--primary)' } : undefined}
      {...rest}
    >
      {children}
    </button>
  );
}

// ── Avatar ─────────────────────────────────────────────────────────────

export function initials(name: string | null | undefined): string {
  return (
    (name ?? '?')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]!.toUpperCase())
      .join('') || '?'
  );
}

export function HrAvatar({ name, size = 36, className }: { name: string; size?: number; className?: string }) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return (
    <span
      aria-hidden
      className={cn('inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white', className)}
      style={{ width: size, height: size, fontSize: size * 0.38, backgroundImage: HR_AVATAR_GRADIENTS[h % HR_AVATAR_GRADIENTS.length] }}
    >
      {initials(name)}
    </span>
  );
}

// ── Month stepper ──────────────────────────────────────────────────────

export function MonthStepper({ value, onChange, max, min, label = 'Month' }: { value: string; onChange: (ym: string) => void; max?: string; min?: string; label?: string }) {
  const m = useMotionSafe();
  const prevDisabled = !!min && addMonths(value, -1) < min;
  const nextDisabled = !!max && addMonths(value, 1) > max;
  return (
    <div role="group" aria-label={label} className="inline-flex items-center gap-1 rounded-full border bg-card p-1 shadow-xs">
      <Button type="button" variant="ghost" size="icon" className="size-8 rounded-full" aria-label="Previous month" disabled={prevDisabled} onClick={() => onChange(addMonths(value, -1))}>
        <ChevronLeft className="size-4" />
      </Button>
      <div className="relative h-8 min-w-[132px] overflow-hidden text-center" aria-live="polite">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={value}
            initial={m.reduce ? false : { y: 14, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={m.reduce ? undefined : { y: -14, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 flex items-center justify-center text-sm font-extrabold"
          >
            {formatMonth(value)}
          </motion.span>
        </AnimatePresence>
      </div>
      <Button type="button" variant="ghost" size="icon" className="size-8 rounded-full" aria-label="Next month" disabled={nextDisabled} onClick={() => onChange(addMonths(value, 1))}>
        <ChevronRight className="size-4" />
      </Button>
    </div>
  );
}

// ── States ─────────────────────────────────────────────────────────────

export function HrEmpty({ icon, title, description, action, compact }: { icon?: LucideIcon; title: string; description?: React.ReactNode; action?: React.ReactNode; compact?: boolean }) {
  return <KitEmptyState icon={icon} title={title} description={description} action={action} accent="members" compact={compact} />;
}

export function HrError({ message = 'Could not load this section.', onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-destructive/40 bg-destructive/5 px-4 py-8 text-center">
      <CircleAlert className="size-6 text-destructive" aria-hidden />
      <p className="text-sm font-semibold">{message}</p>
      {onRetry ? (
        <Button type="button" size="sm" variant="outline" onClick={onRetry}>
          <RefreshCw className="size-3.5" /> Try again
        </Button>
      ) : null}
    </div>
  );
}

export function RowsSkeleton({ rows = 5, height = 52 }: { rows?: number; height?: number }) {
  return (
    <div className="space-y-2" aria-busy aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="w-full rounded-xl" style={{ height }} />
      ))}
    </div>
  );
}

export function FieldLabel({ children, htmlFor, required }: { children: React.ReactNode; htmlFor?: string; required?: boolean }) {
  return (
    <label htmlFor={htmlFor} className="mb-1 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
      {children}
      {required ? <span className="ml-0.5 text-destructive">*</span> : null}
    </label>
  );
}

export const HrTextArea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }>(({ className, invalid, ...props }, ref) => (
  <textarea
    ref={ref}
    aria-invalid={invalid || undefined}
    className={cn(
      'flex min-h-[72px] w-full rounded-lg border border-input bg-background px-3.5 py-2 text-sm shadow-xs placeholder:text-muted-foreground/70',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:border-ring disabled:opacity-50 aria-invalid:border-destructive',
      className,
    )}
    {...props}
  />
));
HrTextArea.displayName = 'HrTextArea';

/** Circular balance ring: `remaining` of `total` in `color`, count-up centre figure. */
export function BalanceRing({ remaining, total, color, label, size = 92, unlimited }: { remaining: number; total: number; color: string; label: string; size?: number; unlimited?: boolean }) {
  const m = useMotionSafe();
  const r = 42;
  const c = 2 * Math.PI * r;
  const frac = unlimited ? 1 : total > 0 ? Math.max(0, Math.min(1, remaining / total)) : 0;
  return (
    <div className="flex flex-col items-center gap-1.5 text-center" role="img" aria-label={unlimited ? `${label}: unlimited, ${remaining} used` : `${label}: ${remaining} of ${total} days remaining`}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden>
          <g fill="none" strokeWidth={10} transform="rotate(-90 50 50)" strokeLinecap="round">
            <circle cx="50" cy="50" r={r} stroke={mix(color, 16)} />
            <motion.circle
              cx="50"
              cy="50"
              r={r}
              stroke={color}
              strokeDasharray={c}
              initial={{ strokeDashoffset: m.reduce ? c * (1 - frac) : c }}
              animate={{ strokeDashoffset: c * (1 - frac) }}
              transition={{ duration: 0.9, delay: 0.15, ease: EASE }}
            />
          </g>
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center leading-none">
          <span className="text-[20px] font-extrabold tabular-nums">
            {unlimited ? '∞' : <AnimatedNumber value={remaining} format={(n) => (Number.isInteger(remaining) ? String(Math.round(n)) : n.toFixed(1))} />}
          </span>
          <span className="mt-0.5 text-[10px] font-semibold text-muted-foreground">{unlimited ? `${remaining} used` : `of ${total}`}</span>
        </div>
      </div>
      <span className="max-w-[110px] truncate text-xs font-bold">{label}</span>
    </div>
  );
}
