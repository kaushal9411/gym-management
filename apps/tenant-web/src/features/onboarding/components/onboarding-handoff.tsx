'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { AlertTriangle, Check, Dumbbell, KeyRound, LayoutDashboard, LogIn, ShieldCheck } from 'lucide-react';

import { LoginHero } from '@/features/auth/components/login-hero';
import { POST_LOGIN_REDIRECT } from '@/features/auth/constants';
import { authService } from '@/features/auth/services/auth.service';
import { sessionEstablished, signedOut, tokensRefreshed } from '@/features/auth/store/auth-slice';
import { AuthServiceError } from '@/features/auth/types';
import { TenantLogo } from '@/features/tenant/components/tenant-logo';
import { useTenant } from '@/features/tenant/tenant-provider';
import { cn } from '@/lib/utils';
import { useAppDispatch } from '@/store/hooks';

/** Where the handoff is. `verify` and `load` are real work (token check, `/auth/me`); `open` is the short beat before the redirect. */
type Phase = 'verify' | 'load' | 'open' | 'error';

const STEPS = [
  { key: 'verify', label: 'Securing your session', hint: 'Checking your one-time link', icon: KeyRound },
  { key: 'load', label: 'Loading your gym', hint: 'Fetching your profile and permissions', icon: Dumbbell },
  { key: 'open', label: 'Opening your dashboard', hint: 'Almost there', icon: LayoutDashboard },
] as const;

const PHASE_INDEX: Record<Exclude<Phase, 'error'>, number> = { verify: 0, load: 1, open: 2 };
/** A beat on the final step so the animation reads before the redirect — kept short, it is not a real wait. */
const OPEN_BEAT_MS = 650;

const containerVariants = { hidden: {}, show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } } };
const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' as const } },
};

/**
 * Landing target for the onboarding wizard's (and the bare-host login's) cross-origin handoff (see
 * utils/portal-url.ts). Reads the one-time tokens out of the URL fragment,
 * exchanges them for a real session on THIS origin, then scrubs the
 * fragment from history before routing to the dashboard — the fragment
 * must never linger in browser history longer than this one render.
 *
 * Same neon-glass shell as `/login`; the three steps mirror what the page really does.
 */
export function OnboardingHandoff() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const tenant = useTenant();
  const reduce = useReducedMotion() ?? false;
  const [phase, setPhase] = React.useState<Phase>('verify');
  const [error, setError] = React.useState<string | null>(null);
  const ranRef = React.useRef(false);

  React.useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    const hash = window.location.hash.replace(/^#/, '');
    const params = new URLSearchParams(hash);
    const accessToken = params.get('at');
    const refreshToken = params.get('rt');
    const accessTokenExpiresAt = params.get('exp');

    // Scrub immediately — regardless of outcome, tokens must not sit in the URL.
    window.history.replaceState(null, '', window.location.pathname);

    if (!accessToken || !refreshToken || !accessTokenExpiresAt) {
      setError('This setup link is invalid or has expired. Please sign in with your new account.');
      setPhase('error');
      return;
    }

    dispatch(tokensRefreshed({ accessToken, refreshToken, accessTokenExpiresAt }));
    setPhase('load');

    authService
      .fetchCurrentUser()
      .then(({ user, permissions }) => {
        dispatch(sessionEstablished({ user, permissions, tokens: { accessToken, refreshToken, accessTokenExpiresAt } }));
        setPhase('open');
        window.setTimeout(() => router.replace(POST_LOGIN_REDIRECT), reduce ? 0 : OPEN_BEAT_MS);
      })
      .catch((err: unknown) => {
        dispatch(signedOut());
        setError(err instanceof AuthServiceError ? err.message : 'Could not complete sign-in. Please log in manually.');
        setPhase('error');
      });
    // Runs once on mount only — this page exists solely to consume a one-time fragment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const failed = phase === 'error';
  const activeIndex = failed ? -1 : PHASE_INDEX[phase];

  return (
    <div className={cn('relative flex min-h-dvh flex-col overflow-hidden', tenant.branding.loginBackgroundUrl && 'dark')}>
      <style>{`
        @keyframes handoff-spin { to { transform: rotate(360deg); } }
        @keyframes handoff-sheen { 0% { transform: translateX(-120%); } 100% { transform: translateX(320%); } }
        @keyframes handoff-pulse { 0%, 100% { opacity: .55; transform: scale(1); } 50% { opacity: 1; transform: scale(1.08); } }
        .handoff-ring {
          background: conic-gradient(from 0deg, transparent 0deg, rgba(255,138,61,.95) 110deg, rgba(34,211,238,.95) 230deg, transparent 340deg);
          -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 4px), #000 calc(100% - 3px));
          mask: radial-gradient(farthest-side, transparent calc(100% - 4px), #000 calc(100% - 3px));
          animation: handoff-spin 1.5s linear infinite;
        }
        .handoff-sheen { animation: handoff-sheen 1.6s ease-in-out infinite; }
        .handoff-pulse { animation: handoff-pulse 1.8s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .handoff-ring, .handoff-sheen, .handoff-pulse { animation: none !important; } }
        .login-glass-card { background: linear-gradient(180deg, rgba(255,255,255,0.88) 0%, rgba(255,255,255,0.72) 100%); }
        .dark .login-glass-card { background: linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.03) 100%); }
        .login-ripple-btn {
          background-image: linear-gradient(135deg, #ff8a3d 0%, #ff5a1f 45%, #e0271b 100%);
          transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s ease-out;
          box-shadow: 0 8px 24px -6px rgba(255, 90, 31, 0.55);
        }
        .login-ripple-btn:hover { transform: translateY(-2px); box-shadow: 0 16px 36px -8px rgba(255, 90, 31, 0.7); }
        .login-ripple-btn:active { transform: translateY(0) scale(0.98); }
      `}</style>

      <LoginHero backgroundImageUrl={tenant.branding.loginBackgroundUrl} />

      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <motion.div initial={reduce ? false : { opacity: 0, y: 16, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.45, ease: 'easeOut' }} className="w-full max-w-md">
          <motion.div variants={containerVariants} initial={reduce ? false : 'hidden'} animate="show">
            <motion.div
              variants={itemVariants}
              className="login-glass-card relative rounded-4xl border border-foreground/10 p-6 shadow-[0_0_60px_-15px_rgba(255,90,31,0.25),0_0_80px_-20px_rgba(34,211,238,0.15)] backdrop-blur-2xl sm:p-8"
              aria-live="polite"
            >
              {/* Brand mark */}
              <div className="mb-6 flex flex-col items-center gap-3 text-center">
                <div className="flex size-14 items-center justify-center rounded-2xl border border-foreground/10 bg-foreground/5 p-2 shadow-[0_0_24px_rgba(255,138,61,0.25)]">
                  <TenantLogo size="lg" className="size-full rounded-xl" />
                </div>
                <div>
                  <p className="text-base font-bold uppercase tracking-wide text-foreground">{tenant.name}</p>
                  <p className="text-[11px] uppercase tracking-[0.2em] text-foreground/40">Gym Portal</p>
                </div>
              </div>

              <AnimatePresence mode="wait" initial={false}>
                {failed ? (
                  <motion.div key="error" initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-5 text-center">
                    <div className="flex size-20 items-center justify-center rounded-full border border-destructive/40 bg-destructive/10 shadow-[0_0_28px_rgba(224,39,27,0.25)]">
                      <AlertTriangle className="size-9 text-destructive" strokeWidth={1.75} aria-hidden />
                    </div>
                    <div className="space-y-1.5">
                      <h1 className="text-2xl font-bold tracking-tight text-foreground">Couldn&apos;t finish signing you in</h1>
                      <p className="text-sm text-foreground/60" role="alert">{error}</p>
                    </div>
                    <a href="/login" className="login-ripple-btn relative flex h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-lg border-0 text-[15px] font-bold uppercase tracking-wide text-white">
                      <LogIn className="size-4" aria-hidden /> Go to sign in
                    </a>
                  </motion.div>
                ) : (
                  <motion.div key="progress" initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-6 text-center">
                    {/* Progress ring around the status icon */}
                    <div className="relative size-24">
                      <div className="handoff-ring absolute inset-0 rounded-full" aria-hidden />
                      <div className="absolute inset-2 flex items-center justify-center rounded-full border border-foreground/10 bg-foreground/5">
                        <AnimatePresence mode="wait" initial={false}>
                          {phase === 'open' ? (
                            <motion.span key="ok" initial={reduce ? false : { scale: 0.4, rotate: -30, opacity: 0 }} animate={{ scale: 1, rotate: 0, opacity: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 16 }}>
                              <Check className="size-9 text-emerald-500" strokeWidth={2.5} aria-hidden />
                            </motion.span>
                          ) : (
                            <motion.span key="shield" exit={{ scale: 0.6, opacity: 0 }} className="handoff-pulse">
                              <ShieldCheck className="size-9 text-primary" strokeWidth={1.75} aria-hidden />
                            </motion.span>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <h1 className="text-2xl font-bold tracking-tight text-foreground">{phase === 'open' ? `Welcome to ${tenant.name}` : 'Signing you in…'}</h1>
                      <p className="text-sm text-foreground/55">
                        {phase === 'open' ? 'Taking you to your dashboard.' : 'Securing your session and opening your gym portal. This only takes a moment.'}
                      </p>
                    </div>

                    {/* Steps — mirror what the page is really doing */}
                    <ol className="w-full space-y-2 text-left">
                      {STEPS.map((step, i) => {
                        const status = i < activeIndex ? 'done' : i === activeIndex ? 'active' : 'pending';
                        const Icon = step.icon;
                        return (
                          <motion.li
                            key={step.key}
                            initial={reduce ? false : { opacity: 0, x: -10 }}
                            animate={{ opacity: status === 'pending' ? 0.5 : 1, x: 0 }}
                            transition={{ delay: reduce ? 0 : 0.15 + i * 0.1, duration: 0.3 }}
                            className={cn('relative flex items-center gap-3 overflow-hidden rounded-xl border px-3 py-2.5 transition-colors', status === 'active' ? 'border-primary/40 bg-primary/5' : status === 'done' ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-foreground/10 bg-foreground/[0.03]')}
                          >
                            <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-full', status === 'done' ? 'bg-emerald-500 text-white' : status === 'active' ? 'bg-primary/15 text-primary' : 'bg-foreground/10 text-foreground/40')}>
                              {status === 'done' ? <Check className="size-4" strokeWidth={3} aria-hidden /> : <Icon className="size-4" aria-hidden />}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block text-sm font-semibold text-foreground">{step.label}</span>
                              <span className="block truncate text-xs text-foreground/50">{step.hint}</span>
                            </span>
                            <span className="sr-only">{status === 'done' ? 'Completed' : status === 'active' ? 'In progress' : 'Waiting'}</span>
                            {status === 'active' && !reduce ? <span aria-hidden className="handoff-sheen pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-primary/15 to-transparent" /> : null}
                          </motion.li>
                        );
                      })}
                    </ol>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            <motion.p variants={itemVariants} className="mt-8 text-center text-[11px] text-foreground/30">
              Powered by <span className="font-semibold text-foreground/45">{tenant.platformName}</span> · © {new Date().getFullYear()}
            </motion.p>
          </motion.div>
        </motion.div>
      </main>
    </div>
  );
}
