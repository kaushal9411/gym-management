'use client';

import * as React from 'react';
import type { LucideIcon } from 'lucide-react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';

import { cn } from '@/lib/utils';

type Tone = 'neutral' | 'destructive' | 'warning' | 'success';

export interface StatusStep {
  label: string;
  hint?: string;
  state?: 'done' | 'active' | 'pending';
}

export interface StatusDetail {
  label: string;
  value: React.ReactNode;
}

interface StatusScreenProps {
  icon: LucideIcon;
  tone?: Tone;
  title: string;
  description: string;
  /** Action buttons / links rendered under the description. */
  children?: React.ReactNode;
  /** Extra fine print (support contact, etc.). */
  footnote?: React.ReactNode;
  /** Optional small icon pinned to the medallion's corner (e.g. a lock on a shield). */
  badge?: LucideIcon;
  /** Optional short pill above the title (e.g. "Error 403"). */
  eyebrow?: string;
  /** Optional "what happens next" checklist. */
  steps?: StatusStep[];
  /** Optional label/value facts (plan, date, …). */
  details?: StatusDetail[];
  /** Render without its own card frame — for use inside an existing card (StatusShell). */
  bare?: boolean;
  className?: string;
}

const TONES: Record<Tone, { text: string; soft: string; ring: string; glow: string; bar: string; wash: string; pill: string }> = {
  neutral: {
    text: 'text-primary',
    soft: 'bg-primary/10',
    ring: 'ring-primary/25',
    glow: 'bg-primary/25',
    bar: 'from-primary/0 via-primary to-primary/0',
    wash: 'from-primary/10',
    pill: 'bg-primary/10 text-primary',
  },
  destructive: {
    text: 'text-destructive',
    soft: 'bg-destructive/10',
    ring: 'ring-destructive/25',
    glow: 'bg-destructive/25',
    bar: 'from-destructive/0 via-destructive to-destructive/0',
    wash: 'from-destructive/10',
    pill: 'bg-destructive/10 text-destructive',
  },
  warning: {
    text: 'text-warning-foreground dark:text-warning',
    soft: 'bg-warning/15',
    ring: 'ring-warning/35',
    glow: 'bg-warning/30',
    bar: 'from-warning/0 via-warning to-warning/0',
    wash: 'from-warning/15',
    pill: 'bg-warning/15 text-warning-foreground dark:text-warning',
  },
  success: {
    text: 'text-success',
    soft: 'bg-success/10',
    ring: 'ring-success/25',
    glow: 'bg-success/25',
    bar: 'from-success/0 via-success to-success/0',
    wash: 'from-success/10',
    pill: 'bg-success/10 text-success',
  },
};

/** Animated icon medallion: soft glow, slowly rotating dashed orbit, gentle float (all disabled under reduced motion). */
export function StatusMedallion({ icon: Icon, badge: Badge, tone = 'neutral' }: { icon: LucideIcon; badge?: LucideIcon; tone?: Tone }) {
  const reduce = useReducedMotion() ?? false;
  const t = TONES[tone];
  return (
    <motion.div
      initial={reduce ? false : { scale: 0.5, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 18 }}
      className="relative flex size-28 items-center justify-center"
    >
      <motion.span
        aria-hidden
        className={cn('absolute inset-3 rounded-full blur-2xl', t.glow)}
        animate={reduce ? undefined : { opacity: [0.55, 1, 0.55], scale: [0.95, 1.1, 0.95] }}
        transition={{ duration: 3.6, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.svg
        aria-hidden
        viewBox="0 0 112 112"
        className={cn('absolute inset-0 size-full', t.text)}
        animate={reduce ? undefined : { rotate: 360 }}
        transition={{ duration: 28, repeat: Infinity, ease: 'linear' }}
      >
        <circle cx="56" cy="56" r="53" fill="none" stroke="currentColor" strokeOpacity="0.35" strokeWidth="1.5" strokeDasharray="3 7" strokeLinecap="round" />
      </motion.svg>
      <motion.div
        animate={reduce ? undefined : { y: [0, -4, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        className={cn('relative flex size-20 items-center justify-center rounded-full ring-4 shadow-lg', t.soft, t.ring, t.text)}
      >
        <Icon className="size-9" strokeWidth={1.75} aria-hidden />
        {Badge ? (
          <span className={cn('absolute -bottom-1 -right-1 flex size-8 items-center justify-center rounded-full border-2 border-card bg-card shadow-md', t.text)}>
            <Badge className="size-4" aria-hidden />
          </span>
        ) : null}
      </motion.div>
    </motion.div>
  );
}

/**
 * Shared template for authentication status pages (verify email, invitation,
 * session, access/billing states, …). Works as a framed card inside the
 * `(auth)` split layout and, with `bare`, inside the full-screen StatusShell.
 */
export function StatusScreen({
  icon,
  tone = 'neutral',
  title,
  description,
  children,
  footnote,
  badge,
  eyebrow,
  steps,
  details,
  bare = false,
  className,
}: StatusScreenProps) {
  const reduce = useReducedMotion() ?? false;
  const t = TONES[tone];

  const body = (
    <div className={cn('relative flex flex-col items-center gap-5 text-center', bare ? 'p-6 sm:p-10' : 'p-6 sm:p-8')}>
      <StatusMedallion icon={icon} badge={badge} tone={tone} />

      <div className="space-y-2">
        {eyebrow ? (
          <span className={cn('inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider', t.pill)}>{eyebrow}</span>
        ) : null}
        <h1 className="text-balance text-2xl font-bold tracking-tight sm:text-[1.7rem]">{title}</h1>
        <p className="mx-auto max-w-md text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base">{description}</p>
      </div>

      {details && details.length > 0 ? (
        <dl className="grid w-full gap-px overflow-hidden rounded-xl border bg-border text-left sm:grid-cols-2">
          {details.map((d) => (
            <div key={d.label} className="bg-card/80 px-4 py-3">
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">{d.label}</dt>
              <dd className="mt-0.5 text-sm font-semibold">{d.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {steps && steps.length > 0 ? (
        <ol className="grid w-full gap-3 text-left">
          {steps.map((s, i) => {
            const state = s.state ?? 'pending';
            return (
              <motion.li
                key={s.label}
                initial={reduce ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 + i * 0.08 }}
                className={cn('flex items-start gap-3 rounded-xl border p-3', state === 'active' ? 'border-primary/40 bg-primary/5' : 'bg-muted/30')}
              >
                <span className="mt-0.5 shrink-0">
                  {state === 'done' ? (
                    <CheckCircle2 className="size-4 text-success" aria-hidden />
                  ) : state === 'active' ? (
                    <Loader2 className={cn('size-4 text-primary', !reduce && 'animate-spin')} aria-hidden />
                  ) : (
                    <span className="block size-4 rounded-full border-2 border-muted-foreground/40" aria-hidden />
                  )}
                </span>
                <span>
                  <span className="block text-sm font-semibold">{s.label}</span>
                  {s.hint ? <span className="block text-xs text-muted-foreground">{s.hint}</span> : null}
                </span>
              </motion.li>
            );
          })}
        </ol>
      ) : null}

      {children ? <div className="flex w-full flex-col items-stretch gap-2 sm:flex-row sm:flex-wrap sm:justify-center [&_a]:min-h-11 [&_button]:min-h-11">{children}</div> : null}
      {footnote ? (
        <div className="max-w-sm border-t border-border/70 pt-4 text-xs leading-relaxed text-muted-foreground">{footnote}</div>
      ) : null}
    </div>
  );

  if (bare) return <div className={className}>{body}</div>;

  return (
    <div className={cn('relative isolate overflow-hidden rounded-2xl border bg-card text-card-foreground shadow-sm', className)} role="status" aria-live="polite">
      <div aria-hidden className={cn('h-1 w-full bg-gradient-to-r', t.bar)} />
      <div aria-hidden className={cn('pointer-events-none absolute inset-x-0 top-0 -z-10 h-48 bg-gradient-to-b to-transparent', t.wash)} />
      {body}
    </div>
  );
}
