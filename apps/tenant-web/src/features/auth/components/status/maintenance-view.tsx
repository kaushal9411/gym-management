'use client';

import * as React from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, Check, CheckCircle2, Loader2, Megaphone, RotateCw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useTenant } from '@/features/tenant/tenant-provider';
import { cn } from '@/lib/utils';
import { StatusShell } from './status-shell';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';
const CHECK_EVERY_S = 30;
/** Warm sunrise gradient (amber → coral → magenta → deep violet) — deliberately NOT the gym's brand blue, so the page reads as 'attention, planned pause'. */
const MAINTENANCE_BACKDROP = 'linear-gradient(135deg, #f59e0b 0%, #f43f5e 36%, #c026d3 68%, #5b21b6 100%)';
const REDIRECT_AFTER_MS = 2500;

type Phase = 'maintenance' | 'idle' | 'back';

/** Reads `maintenanceMode` from the public tenant-resolve endpoint (reachable during maintenance); null = couldn't tell. */
async function fetchMaintenanceMode(slug: string): Promise<boolean | null> {
  try {
    const res = await fetch(`${API_URL}/public/tenants/resolve?slug=${encodeURIComponent(slug)}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const body = (await res.json()) as { data?: { maintenanceMode?: boolean } | null };
    return typeof body.data?.maintenanceMode === 'boolean' ? body.data.maintenanceMode : null;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Keyframes (CSS so they cost nothing in React) + reduced-motion guard */
/* ------------------------------------------------------------------ */

const KEYFRAMES = `
@keyframes maint-ecg{from{stroke-dashoffset:90}to{stroke-dashoffset:-400}}
@keyframes maint-tape{to{background-position:24px 0}}
@keyframes maint-beat{0%,100%{transform:scale(1)}18%{transform:scale(1.35)}34%{transform:scale(1)}50%{transform:scale(1.18)}66%{transform:scale(1)}}
@media (prefers-reduced-motion: reduce){.maint-anim{animation:none !important}}
`;

/* ------------------------------------------------------------------ */
/* Barbell: plates slide on/off the bar (service), snap on (back)       */
/* ------------------------------------------------------------------ */

const PLATES = [
  { x: 80, w: 12, h: 80, o: 1 },
  { x: 67, w: 10, h: 64, o: 0.82 },
  { x: 56, w: 8, h: 48, o: 0.66 },
] as const;

type BarbellMode = 'service' | 'snap' | 'static';

function Plate({ p, i, mode, tone, reduce }: { p: (typeof PLATES)[number]; i: number; mode: BarbellMode; tone: 'primary' | 'success'; reduce: boolean }) {
  const fill = tone === 'success' ? 'fill-success' : 'fill-primary';
  const animated = !reduce && mode !== 'static';
  let animate: React.ComponentProps<typeof motion.g>['animate'];
  let initial: React.ComponentProps<typeof motion.g>['initial'];
  let transition: React.ComponentProps<typeof motion.g>['transition'];
  if (animated && mode === 'service') {
    initial = { x: -90, opacity: 0 };
    animate = { x: 0, opacity: 1 };
    transition = { duration: 1.1, ease: [0.22, 1, 0.36, 1], repeat: Infinity, repeatType: 'reverse', repeatDelay: 1.6 + (2 - i) * 0.3, delay: i * 0.35 };
  } else if (animated && mode === 'snap') {
    initial = { x: -130, opacity: 0 };
    animate = { x: 0, opacity: 1 };
    transition = { type: 'spring', stiffness: 420, damping: 16, delay: 0.15 + i * 0.14 };
  } else {
    initial = false;
  }
  return (
    <g opacity={p.o}>
      <motion.g initial={initial} animate={animate} transition={transition}>
        <rect x={p.x} y={55 - p.h / 2} width={p.w} height={p.h} rx={3} className={fill} />
        <rect x={p.x + 2} y={55 - p.h / 2 + 5} width={2} height={p.h - 10} rx={1} fill="white" opacity={0.3} />
      </motion.g>
    </g>
  );
}

function Barbell({ mode, tone = 'primary', reduce, className }: { mode: BarbellMode; tone?: 'primary' | 'success'; reduce: boolean; className?: string }) {
  const bounce = !reduce && mode === 'snap';
  return (
    <svg viewBox="0 0 320 110" className={cn('h-auto w-full', className)} aria-hidden>
      <motion.g animate={bounce ? { y: [0, -7, 0] } : undefined} transition={{ delay: 0.7, duration: 0.5, ease: 'easeOut' }}>
        <rect x={14} y={51} width={292} height={8} rx={4} className="fill-foreground/25" />
        <rect x={130} y={49} width={60} height={12} rx={3} className="fill-foreground/15" />
        {[0, 1].map((side) => (
          <g key={side} transform={side === 1 ? 'translate(320 0) scale(-1 1)' : undefined}>
            <rect x={14} y={46} width={40} height={18} rx={4} className="fill-foreground/35" />
            {PLATES.map((p, i) => (
              <Plate key={i} p={p} i={i} mode={mode} tone={tone} reduce={reduce} />
            ))}
            <rect x={96} y={42} width={6} height={26} rx={2} className="fill-warning" />
          </g>
        ))}
      </motion.g>
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Confetti burst for the "back online" flip                           */
/* ------------------------------------------------------------------ */

const BURST = Array.from({ length: 16 }, (_, i) => {
  const a = (i / 16) * Math.PI * 2;
  const d = i % 2 === 0 ? 120 : 82;
  return { x: Math.cos(a) * d, y: Math.sin(a) * d * 0.8, tone: ['bg-primary', 'bg-success', 'bg-warning'][i % 3], r: (i * 47) % 180 };
});

function Burst() {
  return (
    <div className="pointer-events-none absolute left-1/2 top-1/2 size-0" aria-hidden>
      {BURST.map((b, i) => (
        <motion.span
          key={i}
          className={cn('absolute -ml-1 -mt-1 block h-2 w-1.5 rounded-sm', b.tone)}
          initial={{ x: 0, y: 0, opacity: 0, scale: 0 }}
          animate={{ x: b.x, y: [0, b.y - 10, b.y + 26], opacity: [0, 1, 0], scale: [0, 1.2, 0.7], rotate: b.r + 220 }}
          transition={{ duration: 1.3, delay: 0.35 + (i % 4) * 0.04, ease: 'easeOut' }}
        />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Decorative layers                                                   */
/* ------------------------------------------------------------------ */

function CautionTape({ reduce }: { reduce: boolean }) {
  return (
    <div
      aria-hidden
      className="maint-anim h-1.5 w-full opacity-80"
      style={{
        backgroundImage: 'linear-gradient(135deg, var(--warning) 25%, transparent 25% 50%, var(--warning) 50% 75%, transparent 75%)',
        backgroundSize: '24px 24px',
        animation: reduce ? undefined : 'maint-tape 1.2s linear infinite',
      }}
    />
  );
}

function Aurora({ reduce, tone }: { reduce: boolean; tone: 'primary' | 'success' }) {
  const a = tone === 'success' ? 'bg-success/25' : 'bg-primary/25';
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <motion.div className={cn('absolute -left-16 top-8 size-64 rounded-full blur-3xl', a)} animate={reduce ? undefined : { x: [0, 50, 0], y: [0, 24, 0] }} transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut' }} />
      <motion.div className="absolute -right-12 bottom-10 size-56 rounded-full bg-warning/20 blur-3xl" animate={reduce ? undefined : { x: [0, -40, 0], y: [0, -26, 0] }} transition={{ duration: 13, repeat: Infinity, ease: 'easeInOut' }} />
    </div>
  );
}

function Words({ text, reduce, className }: { text: string; reduce: boolean; className?: string }) {
  const words = text.split(' ');
  return (
    <span className={className}>
      {words.map((w, i) => (
        <React.Fragment key={`${w}-${i}`}>
          <motion.span className="inline-block" initial={reduce ? false : { opacity: 0, y: 16, filter: 'blur(4px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} transition={{ delay: 0.25 + i * 0.07, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}>
            {w}
          </motion.span>
          {i < words.length - 1 ? ' ' : null}
        </React.Fragment>
      ))}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Steps: Paused -> Upgrading -> Back online (travelling highlight)    */
/* ------------------------------------------------------------------ */

const STEPS = [
  { label: 'Paused', hint: 'Portal paused for everyone', state: 'done' },
  { label: 'Upgrading', hint: 'Our team is on it right now', state: 'active' },
  { label: 'Back online', hint: "We'll take you there", state: 'pending' },
] as const;

function Steps({ reduce }: { reduce: boolean }) {
  return (
    <ol className="relative grid w-full grid-cols-3 text-center">
      <div aria-hidden className="absolute left-[16.67%] right-[16.67%] top-[15px] h-1 overflow-hidden rounded-full bg-muted">
        <motion.div className="absolute inset-y-0 left-0 rounded-full bg-primary" initial={reduce ? false : { width: 0 }} animate={{ width: '50%' }} transition={{ delay: 0.5, duration: 0.9, ease: 'easeOut' }} />
        {reduce ? null : (
          <motion.div
            className="absolute inset-y-0 left-0 w-1/4 rounded-full bg-gradient-to-r from-transparent via-primary/70 to-transparent"
            initial={{ x: '100%' }}
            animate={{ x: ['100%', '400%'] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut', delay: 1.2, repeatDelay: 0.4 }}
          />
        )}
      </div>
      {STEPS.map((s, i) => (
        <motion.li key={s.label} className="relative flex flex-col items-center gap-1.5 px-1" initial={reduce ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 + i * 0.12, duration: 0.45 }}>
          <span className="relative flex size-8 items-center justify-center">
            {s.state === 'active' && !reduce ? <span className="absolute inset-0 animate-ping rounded-full bg-primary/40" aria-hidden /> : null}
            <span
              className={cn(
                'relative flex size-8 items-center justify-center rounded-full border-2 bg-background',
                s.state === 'done' && 'border-primary bg-primary text-primary-foreground',
                s.state === 'active' && 'border-primary text-primary',
                s.state === 'pending' && 'border-muted-foreground/30 text-muted-foreground/50',
              )}
              aria-hidden
            >
              {s.state === 'done' ? <Check className="size-4" /> : s.state === 'active' ? <Loader2 className={cn('size-4', !reduce && 'animate-spin')} /> : <span className="size-2 rounded-full bg-current" />}
            </span>
          </span>
          <span className={cn('text-xs font-semibold sm:text-sm', s.state === 'pending' && 'text-muted-foreground')}>
            {s.label}
            <span className="sr-only">{s.state === 'done' ? ' (completed)' : s.state === 'active' ? ' (in progress)' : ' (up next)'}</span>
          </span>
          <span className="hidden text-xs text-muted-foreground sm:block">{s.hint}</span>
        </motion.li>
      ))}
    </ol>
  );
}

/* ------------------------------------------------------------------ */
/* Check panel: owns the 1-second countdown so the page doesn't re-render */
/* ------------------------------------------------------------------ */

const ECG_D = 'M0 20 H70 l7 -5 l7 5 H112 l6 4 l8 -22 l9 30 l6 -12 H178 l9 -7 l11 7 H300';

function Ecg({ remaining, checking, reduce }: { remaining: number; checking: boolean; reduce: boolean }) {
  // The heartbeat quickens as the next check approaches.
  const seconds = checking ? 0.7 : remaining > 20 ? 3.2 : remaining > 10 ? 2.2 : remaining > 5 ? 1.5 : 0.9;
  return (
    <svg viewBox="0 0 300 40" preserveAspectRatio="none" className="h-9 w-full" aria-hidden>
      <path d={ECG_D} fill="none" strokeWidth={2} vectorEffect="non-scaling-stroke" className="stroke-muted-foreground/25" />
      <path
        d={ECG_D}
        fill="none"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={400}
        vectorEffect="non-scaling-stroke"
        className={cn('stroke-primary', reduce ? 'opacity-60' : 'maint-anim')}
        style={reduce ? undefined : { strokeDasharray: '90 410', animation: `maint-ecg ${seconds}s linear infinite` }}
      />
    </svg>
  );
}

function PlateMeter({ remaining, checking }: { remaining: number; checking: boolean }) {
  const progress = checking ? 1 : 1 - remaining / CHECK_EVERY_S;
  return (
    <div className={cn('flex h-9 items-center gap-1', checking && 'animate-pulse')} aria-hidden>
      {Array.from({ length: 10 }, (_, i) => {
        const fill = Math.min(Math.max(progress * 10 - i, 0), 1);
        const height = 14 + (4.5 - Math.abs(i - 4.5)) * 4;
        return (
          <span key={i} className="relative flex-1 overflow-hidden rounded-[5px] bg-muted" style={{ height }}>
            <span className="absolute inset-y-0 left-0 bg-primary transition-[width] duration-1000 ease-linear" style={{ width: `${fill * 100}%` }} />
          </span>
        );
      })}
    </div>
  );
}

function CheckPanel({ checking, resetToken, lastLabel, reduce, onElapsed, onCheck }: { checking: boolean; resetToken: number; lastLabel: string | null; reduce: boolean; onElapsed: () => void; onCheck: () => void }) {
  const [remaining, setRemaining] = React.useState(CHECK_EVERY_S);

  React.useEffect(() => {
    setRemaining(CHECK_EVERY_S);
  }, [resetToken]);

  React.useEffect(() => {
    if (checking) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === 'hidden') return; // pause while the tab is hidden
      setRemaining((s) => Math.max(s - 1, 0));
    }, 1000);
    return () => window.clearInterval(id);
  }, [checking]);

  React.useEffect(() => {
    if (remaining <= 0) onElapsed();
  }, [remaining, onElapsed]);

  const beatSeconds = checking ? 0.7 : remaining > 20 ? 3.2 : remaining > 10 ? 2.2 : remaining > 5 ? 1.5 : 0.9;

  return (
    <div className="w-full rounded-2xl border border-border bg-background/70 p-4 text-left backdrop-blur-sm">
      <div className="flex items-center justify-between gap-3">
        <div aria-live="off" className="flex min-w-0 items-center gap-2.5">
          <span
            className={cn('size-2.5 shrink-0 rounded-full bg-primary', !reduce && 'maint-anim')}
            style={reduce ? undefined : { animation: `maint-beat ${beatSeconds}s ease-in-out infinite` }}
            aria-hidden
          />
          <div className="min-w-0 text-xs text-muted-foreground">
            <p className="truncate text-sm font-semibold text-foreground tabular-nums">{checking ? 'Checking status…' : `Next check in ${remaining}s`}</p>
            <p className="truncate">{lastLabel ? `Last checked ${lastLabel}` : 'Checks every 30 seconds'}</p>
          </div>
        </div>
        <Button variant="outline" size="sm" className="shrink-0" disabled={checking} onClick={onCheck}>
          {checking ? <Loader2 className="animate-spin" aria-hidden /> : <RotateCw aria-hidden />}
          Check now
        </Button>
      </div>
      <div className="mt-3 space-y-1.5" aria-hidden>
        <Ecg remaining={remaining} checking={checking} reduce={reduce} />
        <PlateMeter remaining={remaining} checking={checking} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* View                                                                */
/* ------------------------------------------------------------------ */

export function MaintenanceView() {
  const tenant = useTenant();
  const reduce = useReducedMotion() ?? false;
  const canPoll = Boolean(tenant.slug) && tenant.id.length > 0;
  const [phase, setPhase] = React.useState<Phase>(tenant.maintenanceMode || !canPoll ? 'maintenance' : 'idle');
  const [checking, setChecking] = React.useState(false);
  const [lastChecked, setLastChecked] = React.useState<Date | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const checkingRef = React.useRef(false);

  const runCheck = React.useCallback(
    async (manual: boolean) => {
      if (!canPoll || checkingRef.current) return;
      checkingRef.current = true;
      setChecking(true);
      setNotice(null);
      const mode = await fetchMaintenanceMode(tenant.slug);
      checkingRef.current = false;
      setChecking(false);
      setLastChecked(new Date());
      if (mode === false) {
        setPhase('back');
      } else if (manual) {
        setNotice(mode === null ? "Couldn't reach the server just now — we'll keep trying." : 'Still under maintenance — we keep checking automatically.');
      }
    },
    [canPoll, tenant.slug],
  );

  const onElapsed = React.useCallback(() => void runCheck(false), [runCheck]);
  const onCheck = React.useCallback(() => void runCheck(true), [runCheck]);

  React.useEffect(() => {
    if (phase !== 'back') return;
    const t = window.setTimeout(() => window.location.assign('/'), REDIRECT_AFTER_MS);
    return () => window.clearTimeout(t);
  }, [phase]);

  const lastLabel = lastChecked ? lastChecked.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : null;

  return (
    <StatusShell maxWidth="max-w-2xl" backdrop={MAINTENANCE_BACKDROP}>
      <style>{KEYFRAMES}</style>
      <AnimatePresence mode="wait" initial={false}>
        {phase === 'maintenance' && (
          <motion.div key="maintenance" initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96, filter: 'blur(6px)' }} transition={{ duration: 0.3 }} className="relative">
            <CautionTape reduce={reduce} />
            <Aurora reduce={reduce} tone="primary" />
            <div className="relative flex flex-col items-center gap-6 p-5 text-center sm:p-9">
              <motion.div initial={reduce ? false : { opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }} className="w-full max-w-[17rem] sm:max-w-xs">
                <Barbell mode="service" reduce={reduce} />
              </motion.div>

              <div className="space-y-3">
                <motion.span initial={reduce ? false : { opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="inline-flex items-center gap-2 rounded-full bg-warning/15 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-warning-foreground dark:text-warning">
                  <span className="relative flex size-2">
                    {reduce ? null : <span className="absolute inline-flex size-full animate-ping rounded-full bg-warning opacity-75" />}
                    <span className="relative inline-flex size-2 rounded-full bg-warning" />
                  </span>
                  Scheduled maintenance
                </motion.span>
                <h1 className="text-balance break-words text-2xl font-bold tracking-tight sm:text-3xl">
                  <Words text={`We're re-racking ${tenant.name}`} reduce={reduce} />
                </h1>
                <motion.p initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} className="mx-auto max-w-md text-sm text-muted-foreground sm:text-base">
                  Your gym portal is briefly paused while we add some new plates. Your data is safe and nothing is lost. This page checks automatically and takes you back the moment we&apos;re done.
                </motion.p>
              </div>

              {tenant.maintenanceMessage ? (
                <motion.div initial={reduce ? false : { opacity: 0, y: 14, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ delay: 0.7, type: 'spring', stiffness: 220, damping: 20 }} className="relative w-full max-w-md overflow-hidden rounded-2xl border border-warning/40 bg-warning/10 p-4 text-left">
                  <span aria-hidden className="absolute inset-y-0 left-0 w-1.5 bg-warning" />
                  <div className="flex items-start gap-3 pl-1.5">
                    <Megaphone className="mt-0.5 size-5 shrink-0 text-warning-foreground dark:text-warning" aria-hidden />
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-warning-foreground/80 dark:text-warning">A note from the team</p>
                      <p className="mt-0.5 whitespace-pre-line break-words text-sm font-medium">{tenant.maintenanceMessage}</p>
                    </div>
                  </div>
                </motion.div>
              ) : null}

              <Steps reduce={reduce} />

              {canPoll ? (
                <motion.div initial={reduce ? false : { opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.85, duration: 0.5 }} className="w-full">
                  <CheckPanel checking={checking} resetToken={lastChecked?.getTime() ?? 0} lastLabel={lastLabel} reduce={reduce} onElapsed={onElapsed} onCheck={onCheck} />
                </motion.div>
              ) : null}

              {tenant.supportEmail ? (
                <p className="text-xs text-muted-foreground">
                  Need help?{' '}
                  <a className="font-medium text-primary underline-offset-2 hover:underline" href={`mailto:${tenant.supportEmail}`}>
                    {tenant.supportEmail}
                  </a>
                </p>
              ) : null}

              <p role="status" aria-live="polite" className="-mt-2 min-h-4 text-xs text-muted-foreground">
                {notice}
              </p>
            </div>
          </motion.div>
        )}

        {phase === 'back' && (
          <motion.div key="back" initial={reduce ? false : { opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 22 }} className="relative">
            <Aurora reduce={reduce} tone="success" />
            <div className="relative flex flex-col items-center gap-5 p-6 text-center sm:p-10">
              <div className="relative w-full max-w-xs">
                <Barbell mode="snap" tone="success" reduce={reduce} />
                {reduce ? null : <Burst />}
                <motion.span
                  initial={reduce ? false : { scale: 0, rotate: -40 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ delay: reduce ? 0 : 0.55, type: 'spring', stiffness: 260, damping: 12 }}
                  className="absolute left-1/2 top-1/2 flex size-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-success text-success-foreground shadow-lg ring-4 ring-background"
                >
                  <Check className="size-8" strokeWidth={3} aria-hidden />
                </motion.span>
              </div>
              <h1 className="text-balance text-2xl font-bold tracking-tight sm:text-3xl">We&apos;re back online!</h1>
              <p className="max-w-sm text-sm text-muted-foreground">Maintenance is finished and everything is racked and ready. Taking you back to {tenant.name}…</p>
              <div className="h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-muted" aria-hidden>
                <motion.div className="h-full origin-left rounded-full bg-success" initial={{ scaleX: reduce ? 1 : 0 }} animate={{ scaleX: 1 }} transition={{ duration: REDIRECT_AFTER_MS / 1000, ease: 'linear' }} />
              </div>
              <Button onClick={() => window.location.assign('/')}>
                Continue now <ArrowRight aria-hidden />
              </Button>
            </div>
          </motion.div>
        )}

        {phase === 'idle' && (
          <motion.div key="idle" initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} className="relative">
            <Aurora reduce={reduce} tone="success" />
            <div className="relative flex flex-col items-center gap-5 p-6 text-center sm:p-10">
              <div className="w-full max-w-[15rem]">
                <Barbell mode="static" tone="success" reduce={reduce} />
              </div>
              <div className="flex items-center gap-2 text-success">
                <CheckCircle2 className="size-5" aria-hidden />
                <span className="text-xs font-semibold uppercase tracking-wider">All systems normal</span>
              </div>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">No maintenance in progress</h1>
              <p className="max-w-sm text-sm text-muted-foreground">{tenant.name} is running normally. You can head back to the app.</p>
              <Button onClick={() => window.location.assign('/')}>
                Go to {tenant.name} <ArrowRight aria-hidden />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </StatusShell>
  );
}
