'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Dumbbell, ShieldCheck } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

import { LoadingButton } from '@/components/ui/loading-button';
import { MEMBER_PORTAL_ROUTES } from '@/features/member-portal/constants';
import { useMemberResendPhoneOtp, useMemberVerifyPhoneOtp } from '@/features/member-portal/hooks/use-member-auth';
import { toMemberAuthServiceError } from '@/features/member-portal/services/member-api-client';
import { TenantLogo } from '@/features/tenant/components/tenant-logo';
import { useTenant } from '@/features/tenant/tenant-provider';
import { AUTH_ROUTES, OTP_LENGTH, OTP_RESEND_COOLDOWN_SECONDS, POST_LOGIN_REDIRECT } from '../../constants';
import { toAuthError, useResendPhoneOtp, useVerifyPhoneOtp } from '../../hooks/use-auth';
import { useCountdown } from '../../hooks/use-countdown';
import { otpSchema } from '../../schemas';
import { maskPhone } from '../../utils/mask';
import { FormAlert } from '../form-alert';
import { LoginHero } from '../login-hero';
import { OtpInput } from '../otp-input';

interface PhoneOtpFormProps {
  phone: string;
  role: 'staff' | 'member';
}

const containerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' as const } },
};

/** Same fixed-dark override as `login-form.tsx`'s `IconField` usage — the OTP boxes otherwise render in the app's light theme tokens, invisible against this page's near-black shell. `OtpInput` layers its own filled/invalid modifiers on top of this idle state. */
const DARK_OTP_BOX_CLASS = 'border-white/15 bg-white/4 text-white focus-visible:ring-orange-400/25 focus-visible:border-orange-400/60';

/**
 * Sibling of `OtpForm` rather than an extension of it — that component is
 * keyed to a staff email and the existing `useVerifyOtp`/`useResendOtp`
 * hooks; phone login needs to branch on role (staff vs. member) to two
 * entirely different backends/sessions, which didn't fit cleanly there.
 * Visually mirrors `LoginForm`'s own-page neon shell (not the shared
 * `(auth)` split-screen layout) — same `LoginHero`, glass card and
 * gradient-ripple button, so the phone-login flow reads as one continuous
 * experience rather than handing off to a differently-themed page.
 */
export function PhoneOtpForm({ phone, role }: PhoneOtpFormProps) {
  const router = useRouter();
  const tenant = useTenant();
  const verifyStaffOtp = useVerifyPhoneOtp();
  const resendStaffOtp = useResendPhoneOtp();
  const verifyMemberOtp = useMemberVerifyPhoneOtp();
  const resendMemberOtp = useMemberResendPhoneOtp();
  const countdown = useCountdown(OTP_RESEND_COOLDOWN_SECONDS);

  const [code, setCode] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [shake, setShake] = React.useState(0);
  const [ripples, setRipples] = React.useState<{ id: number; x: number; y: number }[]>([]);
  const rippleId = React.useRef(0);

  const isPending = role === 'staff' ? verifyStaffOtp.isPending : verifyMemberOtp.isPending;
  const isResending = role === 'staff' ? resendStaffOtp.isPending : resendMemberOtp.isPending;

  // Guard: this screen requires a pending challenge context.
  React.useEffect(() => {
    if (!phone) router.replace(AUTH_ROUTES.login);
  }, [phone, router]);

  const onError = (err: unknown, resetField: () => void) => {
    const message = role === 'staff' ? toAuthError(err).message : toMemberAuthServiceError(err).message;
    setError(message);
    resetField();
    setShake((s) => s + 1);
  };

  const submit = (value: string) => {
    const parsed = otpSchema.safeParse(value);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Enter the complete code');
      return;
    }
    setError(null);

    if (role === 'member') {
      verifyMemberOtp.mutate(
        { phone, code: parsed.data },
        {
          onSuccess: ({ member }) => {
            toast.success(`Welcome back, ${member.name.split(' ')[0]}!`);
            router.push(MEMBER_PORTAL_ROUTES.dashboard);
          },
          onError: (err) => onError(err, () => setCode('')),
        },
      );
      return;
    }

    verifyStaffOtp.mutate(
      { phone, code: parsed.data },
      {
        onSuccess: (result) => {
          if (result.kind === 'otp_required') {
            router.push(`${AUTH_ROUTES.twoFactor}?email=${encodeURIComponent(result.email)}&flow=${result.flow}`);
            return;
          }
          if (result.kind === 'mfa_setup_required') {
            router.push(`${AUTH_ROUTES.mfaSetup}?email=${encodeURIComponent(result.email)}&setupToken=${encodeURIComponent(result.setupToken)}`);
            return;
          }
          toast.success(`Welcome back, ${result.user.name.split(' ')[0]}!`);
          router.push(POST_LOGIN_REDIRECT);
        },
        onError: (err) => onError(err, () => setCode('')),
      },
    );
  };

  const handleResend = () => {
    const onSuccess = () => {
      toast.success(`A new code was sent to the email on file for ${maskPhone(phone)}`);
      countdown.restart(OTP_RESEND_COOLDOWN_SECONDS);
      setCode('');
      setError(null);
    };
    if (role === 'member') resendMemberOtp.mutate(phone, { onSuccess });
    else resendStaffOtp.mutate(phone, { onSuccess });
  };

  function spawnRipple(e: React.MouseEvent<HTMLButtonElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const id = rippleId.current++;
    setRipples((r) => [...r, { id, x: e.clientX - rect.left, y: e.clientY - rect.top }]);
    window.setTimeout(() => setRipples((r) => r.filter((rp) => rp.id !== id)), 650);
  }

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
                  <p className="text-[11px] uppercase tracking-[0.2em] text-white/40">Verify your phone</p>
                </div>
              </div>

              <div className="mb-6 space-y-1 text-center">
                <h1 className="text-2xl font-bold tracking-tight text-white">Enter the verification code</h1>
                <p className="text-sm text-white/50">
                  We sent a {OTP_LENGTH}-digit code to the email on file for {maskPhone(phone)}. It expires in 5 minutes.
                </p>
              </div>

              <FormAlert variant="error" message={error} />

              <div className="space-y-5" style={{ marginTop: error ? '1.25rem' : 0 }}>
                <motion.div
                  key={shake}
                  animate={shake > 0 ? { x: [0, -8, 8, -6, 6, -3, 3, 0] } : undefined}
                  transition={{ duration: 0.4 }}
                >
                  <OtpInput
                    value={code}
                    onChange={(next) => {
                      setCode(next);
                      if (error) setError(null);
                    }}
                    onComplete={submit}
                    disabled={isPending}
                    invalid={!!error}
                    className={DARK_OTP_BOX_CLASS}
                  />
                </motion.div>

                <LoadingButton
                  type="button"
                  onMouseDown={spawnRipple}
                  onClick={() => submit(code)}
                  disabled={code.length !== OTP_LENGTH}
                  loading={isPending}
                  loadingText="Verifying…"
                  className="login-ripple-btn relative h-12 w-full overflow-hidden border-0 text-[15px] font-bold uppercase tracking-wide text-white"
                >
                  <ShieldCheck aria-hidden />
                  Verify
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

                <div className="flex items-center justify-center text-sm text-white/50">
                  {countdown.isRunning ? (
                    <span>
                      Resend available in{' '}
                      <span className="font-medium tabular-nums text-white/80">{countdown.formatted}</span>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleResend}
                      disabled={isResending}
                      className="font-medium text-cyan-300 underline-offset-4 hover:underline disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50 rounded-sm"
                    >
                      {isResending ? 'Sending…' : "Didn't get the code? Resend"}
                    </button>
                  )}
                </div>
              </div>
            </motion.div>

            <motion.p variants={itemVariants} className="mt-6 text-center text-sm text-white/40">
              <Link
                href={AUTH_ROUTES.login}
                className="font-medium text-cyan-300 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50 rounded-sm"
              >
                Use a different account
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
