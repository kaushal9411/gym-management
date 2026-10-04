'use client';

import * as React from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, CheckCircle2, Loader2, RotateCw, ShieldCheck, Wrench } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useTenant } from '@/features/tenant/tenant-provider';
import { cn } from '@/lib/utils';
import { StatusShell } from './status-shell';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';
const CHECK_EVERY_S = 30;
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

function gearPath(cx: number, cy: number, outer: number, inner: number, teeth: number): string {
  const step = (Math.PI * 2) / teeth;
  const pts: string[] = [];
  for (let i = 0; i < teeth; i++) {
    const a = i * step;
    const toothHalf = step * 0.22;
    const valleyHalf = step * 0.28;
    const angles: Array<[number, number]> = [
      [a - valleyHalf, inner],
      [a - toothHalf, outer],
      [a + toothHalf, outer],
      [a + valleyHalf, inner],
    ];
    for (const [ang, r] of angles) pts.push(`${(cx + r * Math.cos(ang)).toFixed(2)},${(cy + r * Math.sin(ang)).toFixed(2)}`);
  }
  return `M${pts.join('L')}Z`;
}

function Gear({ cx, cy, outer, inner, teeth, hole, seconds, reverse, reduce }: { cx: number; cy: number; outer: number; inner: number; teeth: number; hole: number; seconds: number; reverse?: boolean; reduce: boolean }) {
  const d = React.useMemo(() => gearPath(cx, cy, outer, inner, teeth), [cx, cy, outer, inner, teeth]);
  return (
    <g
      className={reduce ? undefined : 'animate-spin'}
      style={{ transformBox: 'fill-box', transformOrigin: 'center', animationDuration: `${seconds}s`, animationDirection: reverse ? 'reverse' : 'normal' }}
    >
      <path d={d} fill="currentColor" fillRule="evenodd" />
      <circle cx={cx} cy={cy} r={hole} className="fill-background" />
      <circle cx={cx} cy={cy} r={hole * 0.45} fill="currentColor" opacity={0.9} />
    </g>
  );
}

function Gears({ reduce }: { reduce: boolean }) {
  return (
    <svg viewBox="0 0 280 220" className="h-40 w-52 text-primary sm:h-48 sm:w-64" aria-hidden>
      <style>{'@keyframes maint-wrench{0%,100%{transform:rotate(-14deg)}50%{transform:rotate(10deg)}}'}</style>
      <g opacity={0.95}>
        <Gear cx={105} cy={105} outer={72} inner={58} teeth={12} hole={22} seconds={24} reduce={reduce} />
      </g>
      <g className="text-primary/70">
        <Gear cx={198} cy={148} outer={46} inner={36} teeth={8} hole={14} seconds={16} reverse reduce={reduce} />
      </g>
      <g className="text-primary/45">
        <Gear cx={218} cy={52} outer={26} inner={20} teeth={6} hole={8} seconds={9} reduce={reduce} />
      </g>
      <g style={{ transformBox: 'fill-box', transformOrigin: '20% 80%', animation: reduce ? undefined : 'maint-wrench 3.2s ease-in-out infinite', transform: reduce ? 'rotate(-14deg)' : undefined }}>
        <Wrench x={132} y={78} width={34} height={34} strokeWidth={1.8} className="text-warning drop-shadow-[0_0_6px_var(--warning)]" />
      </g>
    </svg>
  );
}

function CountdownRing({ remaining, checking }: { remaining: number; checking: boolean }) {
  const r = 15;
  const c = 2 * Math.PI * r;
  const progress = checking ? 1 : 1 - remaining / CHECK_EVERY_S;
  return (
    <span className="relative inline-flex size-9 items-center justify-center" aria-hidden>
      <svg viewBox="0 0 40 40" className="absolute inset-0 -rotate-90">
        <circle cx="20" cy="20" r={r} fill="none" strokeWidth="3" className="stroke-muted" />
        <circle cx="20" cy="20" r={r} fill="none" strokeWidth="3" strokeLinecap="round" className="stroke-primary transition-[stroke-dashoffset] duration-1000 ease-linear" strokeDasharray={c} strokeDashoffset={c * (1 - progress)} />
      </svg>
      {checking ? <Loader2 className="size-4 animate-spin text-primary" /> : <span className="text-[10px] font-semibold tabular-nums text-muted-foreground">{remaining}</span>}
    </span>
  );
}

const STAGES = [
  { label: 'Maintenance started', hint: 'Your gym portal is paused for everyone' },
  { label: 'Upgrading & verifying', hint: 'Our team is working on it right now' },
  { label: 'Back online', hint: "We'll take you there automatically" },
] as const;

export function MaintenanceView() {
  const tenant = useTenant();
  const reduce = useReducedMotion() ?? false;
  const canPoll = Boolean(tenant.slug) && tenant.id.length > 0;
  const [phase, setPhase] = React.useState<Phase>(tenant.maintenanceMode || !canPoll ? 'maintenance' : 'idle');
  const [remaining, setRemaining] = React.useState(CHECK_EVERY_S);
  const [checking, setChecking] = React.useState(false);
  const [lastChecked, setLastChecked] = React.useState<Date | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const checkingRef = React.useRef(false);

  const runCheck = React.useCallback(
    async (manual: boolean) => {
      if (!canPoll || checkingRef.current) return;
      checkingRef.current = true;
      setChecking(true);
      const mode = await fetchMaintenanceMode(tenant.slug);
      checkingRef.current = false;
      setChecking(false);
      setLastChecked(new Date());
      setRemaining(CHECK_EVERY_S);
      if (mode === false) {
        setPhase('back');
      } else if (manual) {
        setNotice(mode === null ? "Couldn't reach the server just now — we'll keep trying." : 'Still under maintenance — we keep checking automatically.');
      }
    },
    [canPoll, tenant.slug],
  );

  React.useEffect(() => {
    if (phase !== 'maintenance' || !canPoll) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === 'hidden' || checkingRef.current) return;
      setRemaining((s) => s - 1);
    }, 1000);
    return () => window.clearInterval(id);
  }, [phase, canPoll]);

  React.useEffect(() => {
    if (phase === 'maintenance' && canPoll && remaining <= 0) void runCheck(false);
  }, [remaining, phase, canPoll, runCheck]);

  React.useEffect(() => {
    if (phase !== 'back') return;
    const t = window.setTimeout(() => window.location.assign('/'), REDIRECT_AFTER_MS);
    return () => window.clearTimeout(t);
  }, [phase]);

  const lastLabel = lastChecked ? lastChecked.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : null;

  return (
    <StatusShell maxWidth="max-w-2xl">
          <AnimatePresence mode="wait" initial={false}>
            {phase === 'maintenance' && (
              <motion.div key="maintenance" initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-6 p-6 text-center sm:p-10">
                <Gears reduce={reduce} />
                <div className="space-y-3">
                  <span className="inline-flex items-center gap-2 rounded-full bg-warning/15 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-warning-foreground dark:text-warning">
                    <span className="relative flex size-2">
                      <span className="absolute inline-flex size-full animate-ping rounded-full bg-warning opacity-75" />
                      <span className="relative inline-flex size-2 rounded-full bg-warning" />
                    </span>
                    Scheduled maintenance
                  </span>
                  <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">We&apos;re upgrading {tenant.name}</h1>
                  <p className="mx-auto max-w-md text-sm text-muted-foreground sm:text-base">
                    Your gym portal is briefly paused while we make improvements. Your data is safe and nothing is lost. This page checks automatically and will take you back as soon as we&apos;re done.
                  </p>
                </div>

                <ol className="grid w-full gap-3 text-left sm:grid-cols-3">
                  {STAGES.map((s, i) => {
                    const state = i === 0 ? 'done' : i === 1 ? 'active' : 'pending';
                    return (
                      <motion.li key={s.label} initial={reduce ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + i * 0.1 }} className={cn('rounded-2xl border p-3', state === 'active' ? 'border-primary/40 bg-primary/5' : 'border-border bg-muted/30')}>
                        <div className="flex items-center gap-2 text-sm font-semibold">
                          {state === 'done' ? <CheckCircle2 className="size-4 text-success" aria-hidden /> : state === 'active' ? <Loader2 className="size-4 animate-spin text-primary" aria-hidden /> : <span className="size-4 rounded-full border-2 border-muted-foreground/40" aria-hidden />}
                          {s.label}
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">{s.hint}</p>
                      </motion.li>
                    );
                  })}
                </ol>

                {canPoll ? (
                  <div className="flex w-full flex-col items-center gap-3 rounded-2xl bg-muted/40 p-4 sm:flex-row sm:justify-between">
                    <div className="flex items-center gap-3 text-left">
                      <CountdownRing remaining={Math.max(remaining, 0)} checking={checking} />
                      <div className="text-xs text-muted-foreground">
                        <p className="font-medium text-foreground">{checking ? 'Checking status…' : `Next automatic check in ${Math.max(remaining, 0)}s`}</p>
                        <p>{lastLabel ? `Last checked ${lastLabel}` : 'We check every 30 seconds'}</p>
                      </div>
                    </div>
                    <Button variant="outline" className="w-full sm:w-auto" disabled={checking} onClick={() => void runCheck(true)}>
                      {checking ? <Loader2 className="animate-spin" aria-hidden /> : <RotateCw aria-hidden />}
                      Check now
                    </Button>
                  </div>
                ) : null}

                {notice ? <p className="text-xs text-muted-foreground" role="status">{notice}</p> : null}
              </motion.div>
            )}

            {phase === 'back' && (
              <motion.div key="back" initial={reduce ? false : { opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-5 p-8 text-center sm:p-12">
                <motion.div initial={reduce ? false : { scale: 0.4, rotate: -30 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 220, damping: 14 }} className="flex size-20 items-center justify-center rounded-full bg-success/15 text-success">
                  <ShieldCheck className="size-10" aria-hidden />
                </motion.div>
                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">We&apos;re back online!</h1>
                <p className="max-w-sm text-sm text-muted-foreground">Maintenance is finished. Taking you back to {tenant.name}…</p>
                <Button onClick={() => window.location.assign('/')}>
                  Continue now <ArrowRight aria-hidden />
                </Button>
              </motion.div>
            )}

            {phase === 'idle' && (
              <motion.div key="idle" initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-5 p-8 text-center sm:p-12">
                <div className="flex size-20 items-center justify-center rounded-full bg-success/15 text-success">
                  <CheckCircle2 className="size-10" aria-hidden />
                </div>
                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">No maintenance in progress</h1>
                <p className="max-w-sm text-sm text-muted-foreground">{tenant.name} is running normally. You can head back to the app.</p>
                <Button onClick={() => window.location.assign('/')}>
                  Go to {tenant.name} <ArrowRight aria-hidden />
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
    </StatusShell>
  );
}
