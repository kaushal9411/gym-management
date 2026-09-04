'use client';

import * as React from 'react';
import Link from 'next/link';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion } from 'framer-motion';
import { AlertCircle, ArrowLeft, CheckCircle2, Lock, MailX } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { Label } from '@/components/ui/label';
import { LoadingButton } from '@/components/ui/loading-button';
import { cn } from '@/lib/utils';
import { AUTH_ROUTES } from '@/features/auth/constants';
import { LoginHero } from '@/features/auth/components/login-hero';
import { PasswordInput } from '@/features/auth/components/password-input';
import { PasswordStrengthMeter } from '@/features/auth/components/password-strength-meter';
import { resetPasswordSchema, type ResetPasswordFormValues } from '@/features/auth/schemas';
import { TenantLogo } from '@/features/tenant/components/tenant-logo';
import { useTenant } from '@/features/tenant/tenant-provider';
import { toStaffError, useAcceptStaffActivation, useStaffActivation } from '../hooks/use-staff';

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
 * Staff activation: set your own password → account flips from
 * PENDING_VERIFICATION to ACTIVE. Same premium neon-glass shell as
 * `/login`/`/forgot-password`/`/reset-password` (this used to be the one
 * screen in that flow still on the old plain-`Card` `(auth)` shell — same
 * inconsistency already fixed on the other three).
 */
export function StaffActivationView({ token }: { token: string }) {
  const tenant = useTenant();
  const activation = useStaffActivation(token);
  const acceptActivation = useAcceptStaffActivation();
  const [accepted, setAccepted] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);

  const form = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });
  const passwordValue = form.watch('password');

  const onSubmit = form.handleSubmit((values) => {
    setServerError(null);
    acceptActivation.mutate(
      { token, password: values.password },
      {
        onSuccess: () => {
          setAccepted(true);
          toast.success('Account activated');
        },
        onError: (error) => setServerError(toStaffError(error).message),
      },
    );
  });

  const isSubmitting = acceptActivation.isPending;
  const fieldError = (name: keyof ResetPasswordFormValues) => form.formState.errors[name]?.message;
  const invite = activation.data;

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

              {activation.isPending ? (
                <div className="space-y-3">
                  <div className="h-4 w-full animate-pulse rounded bg-white/10" />
                  <div className="h-10 w-full animate-pulse rounded bg-white/10" />
                  <div className="h-10 w-full animate-pulse rounded bg-white/10" />
                  <span className="sr-only" role="status">Loading activation link…</span>
                </div>
              ) : activation.isError ? (
                (() => {
                  const err = toStaffError(activation.error);
                  const expired = err.code === 'TOKEN_EXPIRED';
                  return (
                    <div className="flex flex-col items-center gap-5 text-center">
                      <div className="flex size-16 items-center justify-center rounded-full border border-amber-400/30 bg-amber-400/10 shadow-[0_0_24px_rgba(251,191,36,0.25)]">
                        <MailX className="size-8 text-amber-300" strokeWidth={1.75} aria-hidden />
                      </div>
                      <div className="space-y-1.5">
                        <h1 className="text-2xl font-bold tracking-tight text-white">
                          {expired ? 'Activation link expired' : 'Invalid activation link'}
                        </h1>
                        <p className="text-sm text-white/50">
                          {expired
                            ? 'This activation link is no longer valid. Ask your manager to resend it.'
                            : 'This activation link is not valid. Check the link from your email or ask your manager for a new one.'}
                        </p>
                      </div>
                      <Link
                        href={AUTH_ROUTES.login}
                        className="login-ripple-btn relative inline-flex h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-lg border-0 text-[15px] font-bold uppercase tracking-wide text-white"
                      >
                        Go to login
                      </Link>
                    </div>
                  );
                })()
              ) : accepted ? (
                <div className="flex flex-col items-center gap-5 text-center">
                  <div className="flex size-16 items-center justify-center rounded-full border border-emerald-400/30 bg-emerald-400/10 shadow-[0_0_24px_rgba(52,211,153,0.25)]">
                    <CheckCircle2 className="size-8 text-emerald-300" strokeWidth={1.75} aria-hidden />
                  </div>
                  <div className="space-y-1.5">
                    <h1 className="text-2xl font-bold tracking-tight text-white">Account activated!</h1>
                    <p className="text-sm text-white/50">Your password is set. Sign in with your email and new password.</p>
                  </div>
                  <Link
                    href={AUTH_ROUTES.login}
                    className="login-ripple-btn relative inline-flex h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-lg border-0 text-[15px] font-bold uppercase tracking-wide text-white"
                  >
                    Continue to login
                  </Link>
                </div>
              ) : (
                <>
                  <div className="mb-6 space-y-1 text-center">
                    <h1 className="text-2xl font-bold tracking-tight text-white">Activate your account</h1>
                    <p className="text-sm text-white/50">
                      Welcome, {invite?.name}. Set a password for{' '}
                      <span className="font-medium text-white">{invite?.email}</span> to finish setting up your account.
                    </p>
                  </div>

                  {serverError ? (
                    <div className="mb-5 flex items-center gap-2 rounded-lg border border-red-400/30 bg-red-400/10 px-3.5 py-2.5 text-sm text-red-300">
                      <AlertCircle className="size-4 shrink-0" aria-hidden />
                      {serverError}
                    </div>
                  ) : null}

                  <form onSubmit={onSubmit} noValidate className="space-y-5">
                    <div className="space-y-2">
                      <Label htmlFor="password" className="text-xs font-medium uppercase tracking-wide text-white/60">
                        Create password
                      </Label>
                      <div className="relative">
                        <Lock
                          className="pointer-events-none absolute left-3.5 top-1/2 z-10 size-4 -translate-y-1/2 text-white/40"
                          aria-hidden
                        />
                        <PasswordInput
                          id="password"
                          autoComplete="new-password"
                          invalid={!!fieldError('password')}
                          disabled={isSubmitting}
                          className={cn('pl-11 text-[15px]', DARK_FIELD_CLASS)}
                          {...form.register('password')}
                        />
                      </div>
                      <PasswordStrengthMeter password={passwordValue} />
                      {fieldError('password') ? (
                        <p role="alert" className="text-xs text-red-400">{fieldError('password')}</p>
                      ) : null}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword" className="text-xs font-medium uppercase tracking-wide text-white/60">
                        Confirm password
                      </Label>
                      <div className="relative">
                        <Lock
                          className="pointer-events-none absolute left-3.5 top-1/2 z-10 size-4 -translate-y-1/2 text-white/40"
                          aria-hidden
                        />
                        <PasswordInput
                          id="confirmPassword"
                          autoComplete="new-password"
                          invalid={!!fieldError('confirmPassword')}
                          disabled={isSubmitting}
                          className={cn('pl-11 text-[15px]', DARK_FIELD_CLASS)}
                          {...form.register('confirmPassword')}
                        />
                      </div>
                      {fieldError('confirmPassword') ? (
                        <p role="alert" className="text-xs text-red-400">{fieldError('confirmPassword')}</p>
                      ) : null}
                    </div>

                    <LoadingButton
                      type="submit"
                      loading={isSubmitting}
                      loadingText="Activating your account…"
                      className="login-ripple-btn relative h-12 w-full overflow-hidden border-0 text-[15px] font-bold uppercase tracking-wide text-white"
                    >
                      Activate account
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
