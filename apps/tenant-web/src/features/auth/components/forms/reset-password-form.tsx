'use client';

import * as React from 'react';
import Link from 'next/link';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion } from 'framer-motion';
import { ArrowLeft, CheckCircle2, Lock, TimerOff } from 'lucide-react';
import { useForm } from 'react-hook-form';

import { Label } from '@/components/ui/label';
import { LoadingButton } from '@/components/ui/loading-button';
import { cn } from '@/lib/utils';
import { TenantLogo } from '@/features/tenant/components/tenant-logo';
import { useTenant } from '@/features/tenant/tenant-provider';
import { AUTH_ROUTES } from '../../constants';
import { toAuthError, useResetPassword } from '../../hooks/use-auth';
import { resetPasswordSchema, type ResetPasswordFormValues } from '../../schemas';
import { FormAlert } from '../form-alert';
import { LoginHero } from '../login-hero';
import { PasswordInput } from '../password-input';
import { PasswordStrengthMeter } from '../password-strength-meter';

const containerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' as const } },
};

/** Dark-glass field chrome shared with login/forgot-password — same fixed dark values regardless of the app's light/dark toggle, so all three screens read as one continuous experience. */
const DARK_FIELD_CLASS =
  'h-12 border-white/10 bg-white/4 text-white placeholder:text-white/35 focus-visible:border-orange-400/50 focus-visible:ring-orange-400/20';

/** Same premium neon-glass shell as `/login` and `/forgot-password` — mirrors their background, card and footer so the whole auth flow reads as one continuous experience instead of switching styles mid-flow. */
export function ResetPasswordForm({ token }: { token: string }) {
  const tenant = useTenant();
  const resetPassword = useResetPassword();
  const [outcome, setOutcome] = React.useState<'idle' | 'success' | 'expired'>('idle');
  const [serverError, setServerError] = React.useState<string | null>(null);

  const form = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  const passwordValue = form.watch('password');

  const onSubmit = form.handleSubmit((values) => {
    setServerError(null);
    resetPassword.mutate(
      { token, password: values.password },
      {
        onSuccess: () => setOutcome('success'),
        onError: (error) => {
          const authError = toAuthError(error);
          if (authError.code === 'TOKEN_EXPIRED' || authError.code === 'TOKEN_INVALID') {
            setOutcome('expired');
            return;
          }
          setServerError(authError.message);
        },
      },
    );
  });

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
              {/* Brand mark */}
              <div className="mb-7 flex flex-col items-center gap-3 text-center">
                <div className="flex size-16 items-center justify-center rounded-2xl border border-white/10 bg-white/5 p-2 shadow-[0_0_24px_rgba(255,138,61,0.25)]">
                  <TenantLogo size="lg" className="size-full rounded-xl" />
                </div>
                <div>
                  <p className="text-lg font-bold uppercase tracking-wide text-white">{tenant.name}</p>
                  <p className="text-[11px] uppercase tracking-[0.2em] text-white/40">Gym Portal</p>
                </div>
              </div>

              {outcome === 'success' ? (
                <div className="flex flex-col items-center gap-5 text-center">
                  <div className="flex size-16 items-center justify-center rounded-full border border-emerald-400/30 bg-emerald-400/10 shadow-[0_0_24px_rgba(52,211,153,0.25)]">
                    <CheckCircle2 className="size-8 text-emerald-300" strokeWidth={1.75} aria-hidden />
                  </div>
                  <div className="space-y-1.5">
                    <h1 className="text-2xl font-bold tracking-tight text-white">Password updated</h1>
                    <p className="text-sm text-white/50">
                      Your password has been changed and all other sessions were signed out. You can now sign in with
                      your new password.
                    </p>
                  </div>

                  <Link
                    href={AUTH_ROUTES.login}
                    className="login-ripple-btn relative inline-flex h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-lg border-0 text-[15px] font-bold uppercase tracking-wide text-white"
                  >
                    Continue to login
                  </Link>
                </div>
              ) : outcome === 'expired' ? (
                <div className="flex flex-col items-center gap-5 text-center">
                  <div className="flex size-16 items-center justify-center rounded-full border border-amber-400/30 bg-amber-400/10 shadow-[0_0_24px_rgba(251,191,36,0.25)]">
                    <TimerOff className="size-8 text-amber-300" strokeWidth={1.75} aria-hidden />
                  </div>
                  <div className="space-y-1.5">
                    <h1 className="text-2xl font-bold tracking-tight text-white">This link has expired</h1>
                    <p className="text-sm text-white/50">
                      Reset links are valid for 30 minutes and can only be used once. Request a fresh link to
                      continue.
                    </p>
                  </div>

                  <Link
                    href={AUTH_ROUTES.forgotPassword}
                    className="login-ripple-btn relative inline-flex h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-lg border-0 text-[15px] font-bold uppercase tracking-wide text-white"
                  >
                    Request a new link
                  </Link>
                </div>
              ) : (
                <>
                  <div className="mb-6 space-y-1 text-center">
                    <h1 className="text-2xl font-bold tracking-tight text-white">Set a new password</h1>
                    <p className="text-sm text-white/50">Choose a strong password you haven&apos;t used before.</p>
                  </div>

                  <FormAlert variant="error" message={serverError} />

                  <form
                    onSubmit={onSubmit}
                    noValidate
                    className="space-y-5"
                    style={{ marginTop: serverError ? '1.25rem' : 0 }}
                  >
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
                          invalid={!!form.formState.errors.password}
                          disabled={resetPassword.isPending}
                          className={cn('pl-11 text-[15px]', DARK_FIELD_CLASS)}
                          {...form.register('password')}
                        />
                      </div>
                      <PasswordStrengthMeter password={passwordValue} />
                      {form.formState.errors.password ? (
                        <p role="alert" className="text-xs text-red-400">
                          {form.formState.errors.password.message}
                        </p>
                      ) : null}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword" className="text-xs font-medium uppercase tracking-wide text-white/60">
                        Confirm new password
                      </Label>
                      <div className="relative">
                        <Lock
                          className="pointer-events-none absolute left-3.5 top-1/2 z-10 size-4 -translate-y-1/2 text-white/40"
                          aria-hidden
                        />
                        <PasswordInput
                          id="confirmPassword"
                          autoComplete="new-password"
                          invalid={!!form.formState.errors.confirmPassword}
                          disabled={resetPassword.isPending}
                          className={cn('pl-11 text-[15px]', DARK_FIELD_CLASS)}
                          {...form.register('confirmPassword')}
                        />
                      </div>
                      {form.formState.errors.confirmPassword ? (
                        <p role="alert" className="text-xs text-red-400">
                          {form.formState.errors.confirmPassword.message}
                        </p>
                      ) : null}
                    </div>

                    <LoadingButton
                      type="submit"
                      loading={resetPassword.isPending}
                      loadingText="Updating password…"
                      className="login-ripple-btn relative h-12 w-full overflow-hidden border-0 text-[15px] font-bold uppercase tracking-wide text-white"
                    >
                      Update password
                    </LoadingButton>

                    <Link
                      href={AUTH_ROUTES.login}
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
