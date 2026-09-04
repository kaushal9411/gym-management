'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { AlertCircle, ArrowLeft, CheckCircle2, Lock } from 'lucide-react';

import { Label } from '@/components/ui/label';
import { LoadingButton } from '@/components/ui/loading-button';
import { cn } from '@/lib/utils';
import { PasswordInput } from '@/features/auth/components/password-input';
import { PasswordStrengthMeter } from '@/features/auth/components/password-strength-meter';
import { LoginHero } from '@/features/auth/components/login-hero';
import { MEMBER_PORTAL_ROUTES } from '@/features/member-portal/constants';
import { memberAuthService } from '@/features/member-portal/services/member-auth.service';
import type { MemberAuthServiceError } from '@/features/member-portal/types';
import { TenantLogo } from '@/features/tenant/components/tenant-logo';
import { useTenant } from '@/features/tenant/tenant-provider';

const containerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' as const } },
};

const DARK_FIELD_CLASS =
  'h-12 border-white/10 bg-white/4 text-white placeholder:text-white/35 focus-visible:border-orange-400/50 focus-visible:ring-orange-400/20';

/**
 * Member-plane counterpart to `reset-password-form.tsx` — same neon shell
 * as `/login`/`/forgot-password`/`/reset-password` so the whole auth flow
 * reads as one experience regardless of which plane sent the email. Was a
 * separate, un-themed page (plain white `Card`, no neon background) before
 * this pass, same inconsistency `find-gym-form.tsx`/`forgot-password-form`
 * already fixed elsewhere.
 *
 * Unlike the staff version, this one validates the token FIRST (`lookup`,
 * greeting the member by name) rather than only discovering an expired/
 * invalid token after submit — kept as-is, it's the better UX of the two
 * and there's no reason to regress it for the sake of matching.
 */
export default function MemberResetPasswordPage() {
  const tenant = useTenant();
  const router = useRouter();
  const token = useSearchParams().get('token') ?? '';
  const lookup = useQuery({
    queryKey: ['member-password-reset', token],
    queryFn: () => memberAuthService.lookupPasswordReset(token),
    enabled: !!token,
    retry: false,
  });
  const [password, setPassword] = React.useState('');
  const [confirm, setConfirm] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setSubmitting(true);
    try {
      await memberAuthService.resetPassword(token, password);
      setDone(true);
    } catch (err) {
      setError((err as MemberAuthServiceError).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden">
      <style>{`
        .login-glass-card {
          background: linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.03) 100%);
        }
        .login-ripple-btn {
          background-image: linear-gradient(135deg, #ff8a3d 0%, #ff5a1f 45%, #e0271b 100%);
          transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s ease-out;
          box-shadow: 0 8px 24px -6px rgba(255, 90, 31, 0.55);
        }
        .login-ripple-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 16px 36px -8px rgba(255, 90, 31, 0.7);
        }
        .login-ripple-btn:active {
          transform: translateY(0) scale(0.98);
        }
      `}</style>

      <LoginHero backgroundImageUrl={tenant.branding.loginBackgroundUrl} />

      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
          className="w-full max-w-md"
        >
          <motion.div variants={containerVariants} initial="hidden" animate="show">
            <motion.div
              variants={itemVariants}
              className="login-glass-card relative rounded-4xl border border-white/10 p-6 shadow-[0_0_60px_-15px_rgba(255,90,31,0.25),0_0_80px_-20px_rgba(34,211,238,0.15)] backdrop-blur-2xl sm:p-8"
            >
              <div className="mb-7 flex flex-col items-center gap-3 text-center">
                <div className="flex size-16 items-center justify-center rounded-2xl border border-white/10 bg-white/5 p-2 shadow-[0_0_24px_rgba(255,138,61,0.25)]">
                  <TenantLogo size="lg" className="size-full rounded-xl" />
                </div>
                <div>
                  <p className="text-lg font-bold uppercase tracking-wide text-white">{tenant.name}</p>
                  <p className="text-[11px] uppercase tracking-[0.2em] text-white/40">Gym Portal</p>
                </div>
              </div>

              {!token ? (
                <div className="flex flex-col items-center gap-4 text-center">
                  <div className="flex size-16 items-center justify-center rounded-full border border-red-400/30 bg-red-400/10">
                    <AlertCircle className="size-8 text-red-300" strokeWidth={1.75} aria-hidden />
                  </div>
                  <p className="text-sm text-white/50">This link is missing its token.</p>
                </div>
              ) : lookup.isLoading ? (
                <div className="space-y-3">
                  <div className="h-4 w-full animate-pulse rounded bg-white/10" />
                  <div className="h-10 w-full animate-pulse rounded bg-white/10" />
                </div>
              ) : lookup.isError ? (
                <div className="flex flex-col items-center gap-4 text-center">
                  <div className="flex size-16 items-center justify-center rounded-full border border-red-400/30 bg-red-400/10">
                    <AlertCircle className="size-8 text-red-300" strokeWidth={1.75} aria-hidden />
                  </div>
                  <p className="text-sm text-white/50">{(lookup.error as MemberAuthServiceError).message}</p>
                </div>
              ) : done ? (
                <div className="flex flex-col items-center gap-5 text-center">
                  <div className="flex size-16 items-center justify-center rounded-full border border-emerald-400/30 bg-emerald-400/10 shadow-[0_0_24px_rgba(52,211,153,0.25)]">
                    <CheckCircle2 className="size-8 text-emerald-300" strokeWidth={1.75} aria-hidden />
                  </div>
                  <div className="space-y-1.5">
                    <h1 className="text-2xl font-bold tracking-tight text-white">Password updated</h1>
                    <p className="text-sm text-white/50">Your password has been reset. You can now sign in.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => router.push(MEMBER_PORTAL_ROUTES.login)}
                    className="login-ripple-btn relative flex h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-lg border-0 text-[15px] font-bold uppercase tracking-wide text-white"
                  >
                    Go to login
                  </button>
                </div>
              ) : (
                <>
                  <div className="mb-6 space-y-1 text-center">
                    <h1 className="text-2xl font-bold tracking-tight text-white">Set a new password</h1>
                    <p className="text-sm text-white/50">Hi {lookup.data?.memberName}, choose a new password.</p>
                  </div>

                  {error ? (
                    <div className="mb-5 flex items-center gap-2 rounded-lg border border-red-400/30 bg-red-400/10 px-3.5 py-2.5 text-sm text-red-300">
                      <AlertCircle className="size-4 shrink-0" aria-hidden />
                      {error}
                    </div>
                  ) : null}

                  <form onSubmit={onSubmit} className="space-y-5">
                    <div className="space-y-2">
                      <Label htmlFor="password" className="text-xs font-medium uppercase tracking-wide text-white/60">
                        New password
                      </Label>
                      <div className="relative">
                        <Lock
                          className="pointer-events-none absolute left-3.5 top-1/2 z-10 size-4 -translate-y-1/2 text-white/40"
                          aria-hidden
                        />
                        <PasswordInput
                          id="password"
                          autoComplete="new-password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          minLength={8}
                          required
                          // eslint-disable-next-line jsx-a11y/no-autofocus -- deliberate: the first field on a single-purpose reset screen.
                          autoFocus
                          className={cn('pl-11 text-[15px]', DARK_FIELD_CLASS)}
                        />
                      </div>
                      <PasswordStrengthMeter password={password} />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="confirm" className="text-xs font-medium uppercase tracking-wide text-white/60">
                        Confirm password
                      </Label>
                      <div className="relative">
                        <Lock
                          className="pointer-events-none absolute left-3.5 top-1/2 z-10 size-4 -translate-y-1/2 text-white/40"
                          aria-hidden
                        />
                        <PasswordInput
                          id="confirm"
                          autoComplete="new-password"
                          value={confirm}
                          onChange={(e) => setConfirm(e.target.value)}
                          minLength={8}
                          required
                          className={cn('pl-11 text-[15px]', DARK_FIELD_CLASS)}
                        />
                      </div>
                    </div>

                    <LoadingButton
                      type="submit"
                      loading={submitting}
                      loadingText="Saving…"
                      className="login-ripple-btn relative h-12 w-full overflow-hidden border-0 text-[15px] font-bold uppercase tracking-wide text-white"
                    >
                      Reset password
                    </LoadingButton>

                    <Link
                      href="/login"
                      className="flex items-center justify-center gap-2 text-sm font-medium text-white/50 transition-colors hover:text-white"
                    >
                      <ArrowLeft className="size-4" aria-hidden />
                      Back to login
                    </Link>
                  </form>
                </>
              )}
            </motion.div>

            <motion.p variants={itemVariants} className="mt-8 text-center text-[11px] text-white/25">
              Powered by <span className="font-semibold text-white/40">FitCloud</span> · © {new Date().getFullYear()}
            </motion.p>
          </motion.div>
        </motion.div>
      </main>
    </div>
  );
}
