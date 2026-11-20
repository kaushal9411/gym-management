'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { Dumbbell, Lock, Phone, User } from 'lucide-react';

import { Checkbox } from '@/components/ui/checkbox';
import { ThemeToggle } from '@/components/theme-toggle';
import { Label } from '@/components/ui/label';
import { LoadingButton } from '@/components/ui/loading-button';
import { cn } from '@/lib/utils';
import { MEMBER_PORTAL_ROUTES } from '@/features/member-portal/constants';
import { useMemberAuth, useMemberLogin, useMemberRequestPhoneOtp } from '@/features/member-portal/hooks/use-member-auth';
import { toMemberAuthServiceError } from '@/features/member-portal/services/member-api-client';
import { FindGymForm } from '@/features/tenant/components/find-gym-form';
import { TenantLogo } from '@/features/tenant/components/tenant-logo';
import { continueToGym, discoverGyms, PlatformLoginError, type DiscoveredGym } from '@/features/tenant/platform-login';
import { buildPlatformLoginUrl } from '@/features/tenant/subdomain-urls';
import { useTenant } from '@/features/tenant/tenant-provider';
import { useAppSelector } from '@/store/hooks';
import { AUTH_ROUTES, POST_LOGIN_REDIRECT } from '../../constants';
import { useLogin, useRequestPhoneOtp, toAuthError } from '../../hooks/use-auth';
import { phoneLoginSchema, unifiedLoginSchema, type PhoneLoginFormValues, type UnifiedLoginFormValues } from '../../schemas';
import { looksLikeEmail } from '../../utils/identifier';
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

/** Glass field chrome shared by every input on this page. Built on theme tokens, so it reads in both the light and dark theme. */
const DARK_FIELD_CLASS =
  'h-12 border-foreground/15 bg-foreground/5 text-foreground placeholder:text-foreground/40 focus-visible:border-orange-400/50 focus-visible:ring-orange-400/20';

/** Inline text-link look shared by every secondary action on this page. */
const LINK_BUTTON_CLASS =
  'font-medium text-cyan-700 dark:text-cyan-300 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50 rounded-sm';

export function LoginForm() {
  const router = useRouter();
  const login = useLogin();
  const memberLogin = useMemberLogin();
  const requestPhoneOtp = useRequestPhoneOtp();
  const memberRequestPhoneOtp = useMemberRequestPhoneOtp();
  const { isAuthenticated: isMemberAuthenticated, isBootstrapping: isMemberBootstrapping } = useMemberAuth();
  const tenant = useTenant();
  const authenticatedUser = useAppSelector((state) => state.auth.user);
  const [inlineError, setInlineError] = React.useState<{ locked: boolean; message: string } | null>(null);
  const [passwordFocused, setPasswordFocused] = React.useState(false);
  const [ripples, setRipples] = React.useState<{ id: number; x: number; y: number }[]>([]);
  const rippleId = React.useRef(0);

  // Phone numbers can't self-disambiguate staff vs. member the way email/Member-ID can — explicit pill, shown only in phone mode.
  const [mode, setMode] = React.useState<'password' | 'phone'>('password');
  const [phoneRole, setPhoneRole] = React.useState<'staff' | 'member'>('staff');

  // Bare/platform host only (no gym in the address): the gym is discovered from the credentials, not asked for first.
  const isPlatform = tenant.id === 'platform';
  const [platformPending, setPlatformPending] = React.useState(false);
  // Set only when the credentials belong to more than one gym — the visitor then picks which.
  const [platformGyms, setPlatformGyms] = React.useState<DiscoveredGym[] | null>(null);
  // Escape hatch for flows that need a gym before any credentials exist (forgot password, phone login).
  const [pickGymManually, setPickGymManually] = React.useState(false);
  const pendingLogin = React.useRef<{ actorType: 'staff' | 'member'; identifier: string; password: string; rememberMe: boolean } | null>(null);

  const form = useForm<UnifiedLoginFormValues>({
    resolver: zodResolver(unifiedLoginSchema),
    defaultValues: { identifier: '', password: '', rememberMe: false },
  });

  const phoneForm = useForm<PhoneLoginFormValues>({
    resolver: zodResolver(phoneLoginSchema),
    defaultValues: { phone: '' },
  });

  // Prefill remembered email after mount (localStorage is client-only). Member logins are never remembered.
  // `?identifier=` comes from the bare-host login handing a member / 2FA account over to this gym's own login page.
  React.useEffect(() => {
    const handedOver = new URLSearchParams(window.location.search).get('identifier');
    if (handedOver) {
      form.setValue('identifier', handedOver);
      window.history.replaceState(null, '', window.location.pathname);
      return;
    }
    const remembered = getRememberedEmail();
    if (remembered) {
      form.setValue('identifier', remembered);
      form.setValue('rememberMe', true);
    }
  }, [form]);

  async function goToGym(slug: string) {
    const creds = pendingLogin.current;
    if (!creds) return;
    setPlatformPending(true);
    try {
      window.location.assign(await continueToGym({ slug, ...creds }));
    } catch (error) {
      const err = error instanceof PlatformLoginError ? error : null;
      setPlatformGyms(null);
      setPlatformPending(false);
      setInlineError({ locked: err?.code === 'ACCOUNT_LOCKED', message: err?.message ?? 'Something went wrong. Please try again.' });
    }
  }

  async function onSubmitPlatform(values: UnifiedLoginFormValues) {
    const creds = {
      actorType: looksLikeEmail(values.identifier) ? ('staff' as const) : ('member' as const),
      identifier: values.identifier,
      password: values.password,
      rememberMe: values.rememberMe,
    };
    pendingLogin.current = creds;
    setPlatformPending(true);
    try {
      const gyms = await discoverGyms(creds);
      const [only] = gyms;
      if (gyms.length === 1 && only) {
        await goToGym(only.slug);
        return;
      }
      setPlatformGyms(gyms);
      setPlatformPending(false);
    } catch (error) {
      setPlatformPending(false);
      setInlineError({ locked: false, message: error instanceof PlatformLoginError ? error.message : 'Something went wrong. Please try again.' });
    }
  }

  const onSubmit = form.handleSubmit((values) => {
    setInlineError(null);

    if (isPlatform) {
      void onSubmitPlatform(values);
      return;
    }

    if (!looksLikeEmail(values.identifier)) {
      memberLogin.mutate(
        { memberId: values.identifier, password: values.password },
        {
          onSuccess: (result) => {
            toast.success(`Welcome back, ${result.member.name.split(' ')[0]}!`);
            router.push(MEMBER_PORTAL_ROUTES.dashboard);
          },
          onError: (error) => {
            setInlineError({ locked: false, message: error.message });
          },
        },
      );
      return;
    }

    login.mutate(
      { email: values.identifier, password: values.password, rememberMe: values.rememberMe },
      {
        onSuccess: (result) => {
          setRememberedEmail(values.rememberMe ? values.identifier : null);
          if (result.kind === 'otp_required') {
            const route = result.flow === '2fa' ? AUTH_ROUTES.twoFactor : AUTH_ROUTES.verifyOtp;
            router.push(`${route}?email=${encodeURIComponent(result.email)}&flow=${result.flow}`);
            return;
          }
          if (result.kind === 'mfa_setup_required') {
            router.push(`${AUTH_ROUTES.mfaSetup}?email=${encodeURIComponent(result.email)}&setupToken=${encodeURIComponent(result.setupToken)}`);
            return;
          }
          toast.success(`Welcome back, ${result.user.name.split(' ')[0]}!`);
          router.push(POST_LOGIN_REDIRECT);
        },
        onError: (error) => {
          const authError = toAuthError(error);
          if (authError.code === 'EMAIL_NOT_VERIFIED') {
            router.push(`${AUTH_ROUTES.verifyEmail}?status=pending&email=${encodeURIComponent(values.identifier)}`);
            return;
          }
          const redirect = REDIRECT_ERRORS[authError.code];
          if (redirect) {
            router.push(redirect);
            return;
          }
          setInlineError({ locked: authError.code === 'ACCOUNT_LOCKED', message: authError.message });
        },
      },
    );
  });

  const onSubmitPhone = phoneForm.handleSubmit((values) => {
    setInlineError(null);
    const onSuccess = () => router.push(`${AUTH_ROUTES.verifyPhoneOtp}?phone=${encodeURIComponent(values.phone)}&role=${phoneRole}`);
    const onError = (error: unknown) => {
      const message = phoneRole === 'member' ? toMemberAuthServiceError(error).message : toAuthError(error).message;
      setInlineError({ locked: false, message });
    };
    if (phoneRole === 'member') memberRequestPhoneOtp.mutate(values.phone, { onSuccess, onError });
    else requestPhoneOtp.mutate(values.phone, { onSuccess, onError });
  });

  // Already signed in (e.g. navigated back to /login manually) — bounce to whichever plane's dashboard.
  React.useEffect(() => {
    if (authenticatedUser) router.replace(POST_LOGIN_REDIRECT);
    else if (!isMemberBootstrapping && isMemberAuthenticated) router.replace(MEMBER_PORTAL_ROUTES.dashboard);
  }, [authenticatedUser, isMemberAuthenticated, isMemberBootstrapping, router]);

  const isSubmitting = login.isPending || memberLogin.isPending || platformPending;
  const isSendingPhoneOtp = requestPhoneOtp.isPending || memberRequestPhoneOtp.isPending;
  const identifierValue = form.watch('identifier');
  const passwordValue = form.watch('password');
  const phoneValue = phoneForm.watch('phone');

  function toggleMode() {
    setInlineError(null);
    setMode((m) => (m === 'password' ? 'phone' : 'password'));
  }

  function handleChangeGym() {
    window.location.href = buildPlatformLoginUrl();
  }

  function spawnRipple(e: React.MouseEvent<HTMLButtonElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const id = rippleId.current++;
    setRipples((r) => [...r, { id, x: e.clientX - rect.left, y: e.clientY - rect.top }]);
    window.setTimeout(() => setRipples((r) => r.filter((rp) => rp.id !== id)), 650);
  }

  return (
    // A gym that uploaded a login photo keeps the dark neon look on top of it; otherwise the page follows the light/dark theme.
    <div className={cn('relative flex min-h-dvh flex-col overflow-hidden', tenant.branding.loginBackgroundUrl && 'dark')}>
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
          background: linear-gradient(180deg, rgba(255,255,255,0.88) 0%, rgba(255,255,255,0.72) 100%);
        }
        .dark .login-glass-card {
          background: linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.03) 100%);
        }
      `}</style>

      <LoginHero backgroundImageUrl={tenant.branding.loginBackgroundUrl} />

      <div className="absolute right-3 top-3 z-20 sm:right-5 sm:top-4">
        <ThemeToggle />
      </div>

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
              className="login-glass-card relative rounded-4xl border border-foreground/10 p-6 shadow-[0_0_60px_-15px_rgba(255,90,31,0.25),0_0_80px_-20px_rgba(34,211,238,0.15)] backdrop-blur-2xl sm:p-8"
            >
              {/* Brand mark */}
              <div className="mb-7 flex flex-col items-center gap-3 text-center">
                <div className="flex size-16 items-center justify-center rounded-2xl border border-foreground/10 bg-foreground/5 p-2 shadow-[0_0_24px_rgba(255,138,61,0.25)]">
                  {isPlatform ? (
                    <Dumbbell className="size-8 text-orange-400" strokeWidth={1.75} />
                  ) : (
                    <TenantLogo size="lg" className="size-full rounded-xl" />
                  )}
                </div>
                <div>
                  <p className="text-lg font-bold uppercase tracking-wide text-foreground">
                    {isPlatform ? tenant.platformName : tenant.name}
                  </p>
                  {!isPlatform ? <p className="text-[11px] uppercase tracking-[0.2em] text-foreground/40">Gym Portal</p> : null}
                </div>
                {!isPlatform ? (
                  <button
                    type="button"
                    onClick={handleChangeGym}
                    className="text-xs font-medium text-cyan-700 dark:text-cyan-300 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50 rounded-sm"
                  >
                    Change gym
                  </button>
                ) : null}
              </div>

              <div className="mb-6 space-y-1 text-center">
                <h1 className="text-2xl font-bold tracking-tight text-foreground">
                  {isPlatform && pickGymManually ? 'Looking for your gym?' : isPlatform && platformGyms ? 'Choose your gym' : 'Welcome Back'}
                </h1>
                <p className="text-sm text-foreground/50">
                  {isPlatform && pickGymManually
                    ? 'Select your gym to continue.'
                    : isPlatform && platformGyms
                      ? 'Your account is linked to more than one gym. Which one do you want to sign in to?'
                      : 'Sign in to keep your gym running at full pace.'}
                </p>
              </div>

              {isPlatform && pickGymManually ? (
                <>
                  <FindGymForm bare dark />
                  <p className="mt-5 text-center text-sm">
                    <button type="button" onClick={() => setPickGymManually(false)} className={LINK_BUTTON_CLASS}>
                      Sign in with email / member ID instead
                    </button>
                  </p>
                </>
              ) : isPlatform && platformGyms ? (
                <>
                  <FormAlert variant="error" message={inlineError?.message ?? null} />
                  <ul className="space-y-2">
                    {platformGyms.map((gym) => (
                      <li key={gym.slug}>
                        <button
                          type="button"
                          disabled={platformPending}
                          onClick={() => void goToGym(gym.slug)}
                          className="flex w-full items-center justify-between rounded-lg border border-foreground/10 bg-foreground/5 px-4 py-3 text-left text-sm font-semibold text-foreground transition-colors hover:border-orange-400/50 disabled:opacity-50"
                        >
                          <span>{gym.name}</span>
                          <span className="text-xs font-normal text-foreground/40">{gym.slug}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-5 text-center text-sm">
                    <button type="button" onClick={() => setPlatformGyms(null)} className={LINK_BUTTON_CLASS}>
                      Back
                    </button>
                  </p>
                </>
              ) : (
                <>
                  <FormAlert
                    variant={inlineError?.locked ? 'locked' : 'error'}
                    title={inlineError?.locked ? 'Account temporarily locked' : undefined}
                    message={inlineError?.message ?? null}
                  />

                  {mode === 'phone' ? (
                    <form onSubmit={onSubmitPhone} noValidate className="space-y-5" style={{ marginTop: inlineError?.message ? '1.25rem' : 0 }}>
                      <div className="flex gap-1.5 rounded-lg border border-foreground/10 bg-foreground/4 p-1">
                        {(['staff', 'member'] as const).map((r) => (
                          <button
                            key={r}
                            type="button"
                            onClick={() => setPhoneRole(r)}
                            className={cn(
                              'flex-1 rounded-md py-2 text-xs font-semibold uppercase tracking-wide transition-colors',
                              phoneRole === r ? 'bg-orange-500/90 text-white shadow-sm' : 'text-white/50 hover:text-white/80',
                            )}
                          >
                            {r === 'staff' ? 'Staff' : 'Member'}
                          </button>
                        ))}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="phone" className="text-xs font-medium uppercase tracking-wide text-foreground/60">
                          Mobile number
                        </Label>
                        <IconField
                          id="phone"
                          icon={Phone}
                          type="tel"
                          autoComplete="tel"
                          placeholder="9876543210"
                          invalid={!!phoneForm.formState.errors.phone}
                          showSuccess={phoneForm.formState.touchedFields.phone && !!phoneValue}
                          aria-describedby={phoneForm.formState.errors.phone ? 'phone-error' : undefined}
                          disabled={isSendingPhoneOtp}
                          iconClassName="text-foreground/40 group-focus-within:text-orange-400"
                          glowClassName="shadow-[0_0_0_4px_rgba(255,138,61,0.18)]"
                          className={DARK_FIELD_CLASS}
                          {...phoneForm.register('phone')}
                        />
                        {phoneForm.formState.errors.phone ? (
                          <p id="phone-error" role="alert" className="text-xs text-red-400">
                            {phoneForm.formState.errors.phone.message}
                          </p>
                        ) : null}
                      </div>

                      <LoadingButton
                        type="submit"
                        onMouseDown={spawnRipple}
                        loading={isSendingPhoneOtp}
                        loadingText="Sending code…"
                        disabled={!phoneValue}
                        className="login-ripple-btn relative h-12 w-full overflow-hidden border-0 text-[15px] font-bold uppercase tracking-wide text-white"
                      >
                        Send code
                      </LoadingButton>
                    </form>
                  ) : (
                  <form onSubmit={onSubmit} noValidate className="space-y-5" style={{ marginTop: inlineError?.message ? '1.25rem' : 0 }}>
                    <div className="space-y-2">
                      <Label htmlFor="identifier" className="text-xs font-medium uppercase tracking-wide text-foreground/60">
                        Email or Member ID
                      </Label>
                      <IconField
                        id="identifier"
                        icon={User}
                        type="text"
                        autoComplete="username"
                        placeholder="you@example.com or MEM-0001"
                        invalid={!!form.formState.errors.identifier}
                        showSuccess={form.formState.touchedFields.identifier && !!identifierValue}
                        aria-describedby={form.formState.errors.identifier ? 'identifier-error' : undefined}
                        disabled={isSubmitting}
                        iconClassName="text-foreground/40 group-focus-within:text-orange-400"
                        glowClassName="shadow-[0_0_0_4px_rgba(255,138,61,0.18)]"
                        className={DARK_FIELD_CLASS}
                        {...form.register('identifier')}
                      />
                      {form.formState.errors.identifier ? (
                        <p id="identifier-error" role="alert" className="text-xs text-red-400">
                          {form.formState.errors.identifier.message}
                        </p>
                      ) : null}
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="password" className="text-xs font-medium uppercase tracking-wide text-foreground/60">
                          Password
                        </Label>
                        {isPlatform ? (
                          // Needs a gym before any credentials exist to discover one from.
                          <button type="button" onClick={() => setPickGymManually(true)} className={cn('text-xs', LINK_BUTTON_CLASS)}>
                            Forgot password?
                          </button>
                        ) : (
                          <Link href={AUTH_ROUTES.forgotPassword} className={cn('text-xs', LINK_BUTTON_CLASS)}>
                            Forgot password?
                          </Link>
                        )}
                      </div>
                      <div
                        className={cn(
                          'relative rounded-lg transition-shadow duration-200',
                          passwordFocused && !form.formState.errors.password && 'shadow-[0_0_0_4px_rgba(255,138,61,0.18)]',
                        )}
                      >
                        <Lock
                          className={cn(
                            'pointer-events-none absolute left-3.5 top-1/2 z-10 size-4 -translate-y-1/2 text-foreground/40 transition-colors duration-200',
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
                            className="border-foreground/25 data-[state=checked]:border-orange-400 data-[state=checked]:bg-orange-400"
                          />
                          <Label htmlFor="remember-me" className="cursor-pointer font-normal text-foreground/60">
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
                      disabled={!identifierValue || !passwordValue}
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
                  )}

                  <p className="mt-5 text-center text-sm">
                    {isPlatform ? (
                      <button type="button" onClick={() => setPickGymManually(true)} className={LINK_BUTTON_CLASS}>
                        Choose your gym instead
                      </button>
                    ) : (
                      <button type="button" onClick={toggleMode} className={LINK_BUTTON_CLASS}>
                        {mode === 'phone' ? 'Use email / member ID instead' : 'Use phone number instead'}
                      </button>
                    )}
                  </p>
                </>
              )}
            </motion.div>

            <motion.p variants={itemVariants} className="mt-6 text-center text-sm text-foreground/40">
              Want {tenant.platformName} for your gym?{' '}
              <Link href={AUTH_ROUTES.register} className="font-medium text-cyan-700 dark:text-cyan-300 underline-offset-4 hover:underline">
                Start a free trial
              </Link>
            </motion.p>

            <motion.p variants={itemVariants} className="mt-8 text-center text-[11px] text-foreground/25">
              Powered by <span className="font-semibold text-foreground/40">{tenant.platformName}</span> · © {new Date().getFullYear()}
            </motion.p>
          </motion.div>
        </motion.div>
      </main>
    </div>
  );
}
