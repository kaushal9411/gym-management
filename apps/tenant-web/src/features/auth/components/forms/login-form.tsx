'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { Dumbbell, Lock, Mail } from 'lucide-react';

import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { LoadingButton } from '@/components/ui/loading-button';
import { cn } from '@/lib/utils';
import { FindGymForm } from '@/features/tenant/components/find-gym-form';
import { TenantLogo } from '@/features/tenant/components/tenant-logo';
import { useTenant } from '@/features/tenant/tenant-provider';
import { useAppSelector } from '@/store/hooks';
import { AUTH_ROUTES, POST_LOGIN_REDIRECT } from '../../constants';
import { useLogin, toAuthError } from '../../hooks/use-auth';
import { loginSchema, type LoginFormValues } from '../../schemas';
import { getRememberedEmail, setRememberedEmail } from '../../utils/remember-me';
import { FormAlert } from '../form-alert';
import { IconField } from '../icon-field';
import { LoginHero } from '../login-hero';
import { PasswordInput } from '../password-input';

/** Error codes that navigate to a dedicated status page instead of inline. */
const REDIRECT_ERRORS: Record<string, string> = {
  ACCOUNT_SUSPENDED: AUTH_ROUTES.accountSuspended,
  TENANT_SUSPENDED: AUTH_ROUTES.accountSuspended,
  SUBSCRIPTION_EXPIRED: AUTH_ROUTES.subscriptionExpired,
  TRIAL_EXPIRED: AUTH_ROUTES.trialExpired,
  MAINTENANCE: AUTH_ROUTES.maintenance,
};

const containerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' as const } },
};

/** Dark-glass field chrome shared by every input on this page — overrides the theme-reactive base tokens with fixed dark values, since this page commits to one dramatic neon-dark look regardless of the app's light/dark toggle. */
const DARK_FIELD_CLASS =
  'h-12 border-white/10 bg-white/4 text-white placeholder:text-white/35 focus-visible:border-orange-400/50 focus-visible:ring-orange-400/20';

export function LoginForm() {
  const router = useRouter();
  const login = useLogin();
  const tenant = useTenant();
  const authenticatedUser = useAppSelector((state) => state.auth.user);
  const [inlineError, setInlineError] = React.useState<{ locked: boolean; message: string } | null>(null);
  const [passwordFocused, setPasswordFocused] = React.useState(false);
  const [ripples, setRipples] = React.useState<{ id: number; x: number; y: number }[]>([]);
  const rippleId = React.useRef(0);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '', rememberMe: false },
  });

  // Prefill remembered email after mount (localStorage is client-only).
  React.useEffect(() => {
    const remembered = getRememberedEmail();
    if (remembered) {
      form.setValue('email', remembered);
      form.setValue('rememberMe', true);
    }
  }, [form]);

  const onSubmit = form.handleSubmit((values) => {
    setInlineError(null);
    login.mutate(values, {
      onSuccess: (result) => {
        setRememberedEmail(values.rememberMe ? values.email : null);
        if (result.kind === 'otp_required') {
          const route = result.flow === '2fa' ? AUTH_ROUTES.twoFactor : AUTH_ROUTES.verifyOtp;
          router.push(`${route}?email=${encodeURIComponent(result.email)}&flow=${result.flow}`);
          return;
        }
        toast.success(`Welcome back, ${result.user.name.split(' ')[0]}!`);
        router.push(POST_LOGIN_REDIRECT);
      },
      onError: (error) => {
        const authError = toAuthError(error);
        if (authError.code === 'EMAIL_NOT_VERIFIED') {
          router.push(`${AUTH_ROUTES.verifyEmail}?status=pending&email=${encodeURIComponent(values.email)}`);
          return;
        }
        const redirect = REDIRECT_ERRORS[authError.code];
        if (redirect) {
          router.push(redirect);
          return;
        }
        setInlineError({ locked: authError.code === 'ACCOUNT_LOCKED', message: authError.message });
      },
    });
  });

  // Already signed in (e.g. navigated back to /login manually) — bounce to the dashboard.
  React.useEffect(() => {
    if (authenticatedUser) router.replace(POST_LOGIN_REDIRECT);
  }, [authenticatedUser, router]);

  const isSubmitting = login.isPending;
  const emailValue = form.watch('email');
  const passwordValue = form.watch('password');

  function spawnRipple(e: React.MouseEvent<HTMLButtonElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const id = rippleId.current++;
    setRipples((r) => [...r, { id, x: e.clientX - rect.left, y: e.clientY - rect.top }]);
    window.setTimeout(() => setRipples((r) => r.filter((rp) => rp.id !== id)), 650);
  }

  // No real gym subdomain resolved (bare host/apex domain) — a login form
  // that can never succeed is worse than no form at all, so the same
  // premium shell hosts the "find your gym" fields instead.
  const isPlatform = tenant.id === 'platform';

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden">
      <style>{`
        @keyframes login-ripple {
          from { transform: scale(0); opacity: 0.45; }
          to { transform: scale(1); opacity: 0; }
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
        .login-glass-card {
          background: linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.03) 100%);
        }
      `}</style>

      <LoginHero />

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
                  {isPlatform ? (
                    <Dumbbell className="size-8 text-orange-400" strokeWidth={1.75} />
                  ) : (
                    <TenantLogo size="lg" className="size-full rounded-xl" />
                  )}
                </div>
                <div>
                  <p className="text-lg font-bold uppercase tracking-wide text-white">
                    {isPlatform ? 'FitCloud' : tenant.name}
                  </p>
                  {!isPlatform ? <p className="text-[11px] uppercase tracking-[0.2em] text-white/40">Gym Portal</p> : null}
                </div>
              </div>

              <div className="mb-6 space-y-1 text-center">
                <h1 className="text-2xl font-bold tracking-tight text-white">
                  {isPlatform ? 'Looking for your gym?' : 'Welcome Back'}
                </h1>
                <p className="text-sm text-white/50">
                  {isPlatform
                    ? "Enter your gym's FitCloud subdomain to continue."
                    : 'Sign in to keep your gym running at full pace.'}
                </p>
              </div>

              {isPlatform ? (
                <FindGymForm bare dark />
              ) : (
                <>
                  <FormAlert
                    variant={inlineError?.locked ? 'locked' : 'error'}
                    title={inlineError?.locked ? 'Account temporarily locked' : undefined}
                    message={inlineError?.message ?? null}
                  />

                  <form onSubmit={onSubmit} noValidate className="space-y-5" style={{ marginTop: inlineError?.message ? '1.25rem' : 0 }}>
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
                        disabled={isSubmitting}
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

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="password" className="text-xs font-medium uppercase tracking-wide text-white/60">
                          Password
                        </Label>
                        <Link
                          href={AUTH_ROUTES.forgotPassword}
                          className="text-xs font-medium text-cyan-300 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50 rounded-sm"
                        >
                          Forgot password?
                        </Link>
                      </div>
                      <div
                        className={cn(
                          'relative rounded-lg transition-shadow duration-200',
                          passwordFocused && !form.formState.errors.password && 'shadow-[0_0_0_4px_rgba(255,138,61,0.18)]',
                        )}
                      >
                        <Lock
                          className={cn(
                            'pointer-events-none absolute left-3.5 top-1/2 z-10 size-4 -translate-y-1/2 text-white/40 transition-colors duration-200',
                            passwordFocused && !form.formState.errors.password && 'text-orange-400',
                          )}
                          aria-hidden
                        />
                        <PasswordInput
                          {...form.register('password')}
                          id="password"
                          autoComplete="current-password"
                          placeholder="••••••••••"
                          invalid={!!form.formState.errors.password}
                          aria-describedby={form.formState.errors.password ? 'password-error' : undefined}
                          disabled={isSubmitting}
                          className={cn('pl-11 text-[15px]', DARK_FIELD_CLASS)}
                          onFocus={() => setPasswordFocused(true)}
                          onBlur={(e) => {
                            setPasswordFocused(false);
                            void form.register('password').onBlur(e);
                          }}
                        />
                      </div>
                      {form.formState.errors.password ? (
                        <p id="password-error" role="alert" className="text-xs text-red-400">
                          {form.formState.errors.password.message}
                        </p>
                      ) : null}
                    </div>

                    <Controller
                      control={form.control}
                      name="rememberMe"
                      render={({ field }) => (
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id="remember-me"
                            checked={field.value}
                            onCheckedChange={(checked) => field.onChange(checked === true)}
                            disabled={isSubmitting}
                            className="border-white/25 data-[state=checked]:border-orange-400 data-[state=checked]:bg-orange-400"
                          />
                          <Label htmlFor="remember-me" className="cursor-pointer font-normal text-white/60">
                            Remember me
                          </Label>
                        </div>
                      )}
                    />

                    <LoadingButton
                      type="submit"
                      onMouseDown={spawnRipple}
                      loading={isSubmitting}
                      loadingText="Signing in…"
                      disabled={!emailValue || !passwordValue}
                      className="login-ripple-btn relative h-12 w-full overflow-hidden border-0 text-[15px] font-bold uppercase tracking-wide text-white"
                    >
                      Sign In
                      {ripples.map((r) => (
                        <span
                          key={r.id}
                          className="pointer-events-none absolute rounded-full bg-white/50"
                          style={{
                            left: r.x,
                            top: r.y,
                            width: 10,
                            height: 10,
                            marginLeft: -5,
                            marginTop: -5,
                            animation: 'login-ripple 0.65s ease-out',
                          }}
                        />
                      ))}
                    </LoadingButton>
                  </form>
                </>
              )}
            </motion.div>

            {isPlatform ? null : (
              <motion.p variants={itemVariants} className="mt-6 text-center text-sm text-white/40">
                Want FitCloud for your gym?{' '}
                <Link href={AUTH_ROUTES.register} className="font-medium text-cyan-300 underline-offset-4 hover:underline">
                  Start a free trial
                </Link>
              </motion.p>
            )}

            <motion.p variants={itemVariants} className="mt-8 text-center text-[11px] text-white/25">
              Powered by <span className="font-semibold text-white/40">FitCloud</span> · © {new Date().getFullYear()}
            </motion.p>
          </motion.div>
        </motion.div>
      </main>
    </div>
  );
}
