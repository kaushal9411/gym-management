'use client';

import * as React from 'react';
import Link from 'next/link';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion } from 'framer-motion';
import { ArrowLeft, Mail, MailCheck } from 'lucide-react';
import { useForm } from 'react-hook-form';

import { Label } from '@/components/ui/label';
import { LoadingButton } from '@/components/ui/loading-button';
import { TenantLogo } from '@/features/tenant/components/tenant-logo';
import { useTenant } from '@/features/tenant/tenant-provider';
import { AUTH_ROUTES } from '../../constants';
import { useForgotPassword } from '../../hooks/use-auth';
import { forgotPasswordSchema, type ForgotPasswordFormValues } from '../../schemas';
import { maskEmail } from '../../utils/mask';
import { IconField } from '../icon-field';
import { LoginHero } from '../login-hero';

const containerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' as const } },
};

/** Dark-glass field chrome shared with the login page — same fixed dark values regardless of the app's light/dark toggle, so the two screens read as one continuous experience. */
const DARK_FIELD_CLASS =
  'h-12 border-white/10 bg-white/4 text-white placeholder:text-white/35 focus-visible:border-orange-400/50 focus-visible:ring-orange-400/20';

/** Same premium neon-glass shell as `/login` — mirrors its background, card and footer so navigating between the two feels like one page. */
export function ForgotPasswordForm() {
  const tenant = useTenant();
  const forgotPassword = useForgotPassword();
  const [sentTo, setSentTo] = React.useState<string | null>(null);

  const form = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  const onSubmit = form.handleSubmit((values) => {
    // Always resolves to success — the API never reveals whether an email exists.
    forgotPassword.mutate(values.email, { onSuccess: () => setSentTo(values.email) });
  });

  const emailValue = form.watch('email');

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

              {sentTo ? (
                <div className="flex flex-col items-center gap-5 text-center">
                  <div className="flex size-16 items-center justify-center rounded-full border border-emerald-400/30 bg-emerald-400/10 shadow-[0_0_24px_rgba(52,211,153,0.25)]">
                    <MailCheck className="size-8 text-emerald-300" strokeWidth={1.75} aria-hidden />
                  </div>
                  <div className="space-y-1.5">
                    <h1 className="text-2xl font-bold tracking-tight text-white">Check your email</h1>
                    <p className="text-sm text-white/50">
                      If an account exists for {maskEmail(sentTo)}, a password reset link is on its way. The link expires
                      in 30 minutes.
                    </p>
                  </div>

                  <Link
                    href={AUTH_ROUTES.login}
                    className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 text-[15px] font-medium text-white transition-colors hover:bg-white/10"
                  >
                    <ArrowLeft className="size-4" aria-hidden />
                    Back to login
                  </Link>

                  <p className="text-xs text-white/30">Didn&apos;t get it? Check spam, or try again in a minute.</p>
                </div>
              ) : (
                <>
                  <div className="mb-6 space-y-1 text-center">
                    <h1 className="text-2xl font-bold tracking-tight text-white">Forgot your password?</h1>
                    <p className="text-sm text-white/50">Enter your email and we&apos;ll send you a reset link.</p>
                  </div>

                  <form onSubmit={onSubmit} noValidate className="space-y-5">
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-xs font-medium uppercase tracking-wide text-white/60">
                        Email
                      </Label>
                      <IconField
                        id="email"
                        icon={Mail}
                        type="email"
                        autoComplete="email"
                        placeholder="you@example.com"
                        invalid={!!form.formState.errors.email}
                        showSuccess={form.formState.touchedFields.email && !!emailValue}
                        aria-describedby={form.formState.errors.email ? 'email-error' : undefined}
                        disabled={forgotPassword.isPending}
                        iconClassName="text-white/40 group-focus-within:text-orange-400"
                        glowClassName="shadow-[0_0_0_4px_rgba(255,138,61,0.18)]"
                        className={DARK_FIELD_CLASS}
                        {...form.register('email')}
                      />
                      {form.formState.errors.email ? (
                        <p id="email-error" role="alert" className="text-xs text-red-400">
                          {form.formState.errors.email.message}
                        </p>
                      ) : null}
                    </div>

                    <LoadingButton
                      type="submit"
                      loading={forgotPassword.isPending}
                      loadingText="Sending link…"
                      className="login-ripple-btn relative h-12 w-full overflow-hidden border-0 text-[15px] font-bold uppercase tracking-wide text-white"
                    >
                      Send reset link
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

            <motion.p variants={itemVariants} className="mt-6 text-center text-sm text-white/40">
              Want FitCloud for your gym?{' '}
              <Link href={AUTH_ROUTES.register} className="font-medium text-cyan-300 underline-offset-4 hover:underline">
                Start a free trial
              </Link>
            </motion.p>

            <motion.p variants={itemVariants} className="mt-8 text-center text-[11px] text-white/25">
              Powered by <span className="font-semibold text-white/40">FitCloud</span> · © {new Date().getFullYear()}
            </motion.p>
          </motion.div>
        </motion.div>
      </main>
    </div>
  );
}
