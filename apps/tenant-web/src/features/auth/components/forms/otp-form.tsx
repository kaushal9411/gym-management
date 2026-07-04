'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CheckCircle2, ShieldCheck } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { AUTH_ROUTES, OTP_LENGTH, OTP_RESEND_COOLDOWN_SECONDS } from '../../constants';
import { toAuthError, useResendOtp, useVerifyOtp } from '../../hooks/use-auth';
import { useCountdown } from '../../hooks/use-countdown';
import { otpSchema } from '../../schemas';
import type { OtpFlow } from '../../types';
import { maskEmail } from '../../utils/mask';
import { AuthHeader } from '../auth-header';
import { FormAlert } from '../form-alert';
import { LoadingButton } from '../loading-button';
import { OtpInput } from '../otp-input';

interface OtpFormProps {
  email: string;
  flow: OtpFlow;
  /** 2FA hides the resend/cooldown (codes come from the authenticator app). */
  variant?: 'otp' | '2fa';
}

/** Shared by /verify-otp and /two-factor — same machine, different copy. */
export function OtpForm({ email, flow, variant = 'otp' }: OtpFormProps) {
  const router = useRouter();
  const verifyOtp = useVerifyOtp();
  const resendOtp = useResendOtp();
  const countdown = useCountdown(variant === 'otp' ? OTP_RESEND_COOLDOWN_SECONDS : 0);

  const [code, setCode] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [succeeded, setSucceeded] = React.useState(false);
  const [shake, setShake] = React.useState(0);

  // Guard: this screen requires a pending challenge context.
  React.useEffect(() => {
    if (!email) router.replace(AUTH_ROUTES.login);
  }, [email, router]);

  const submit = (value: string) => {
    const parsed = otpSchema.safeParse(value);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Enter the complete code');
      return;
    }
    setError(null);
    verifyOtp.mutate(
      { email, code: parsed.data, flow },
      {
        onSuccess: () => {
          setSucceeded(true);
          toast.success('Verification successful');
        },
        onError: (err) => {
          const authError = toAuthError(err);
          setError(authError.message);
          setCode('');
          setShake((s) => s + 1);
        },
      },
    );
  };

  const handleResend = () => {
    resendOtp.mutate(email, {
      onSuccess: () => {
        toast.success(`A new code was sent to ${maskEmail(email)}`);
        countdown.restart(OTP_RESEND_COOLDOWN_SECONDS);
        setCode('');
        setError(null);
      },
    });
  };

  if (succeeded) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 18 }}
            className="flex size-16 items-center justify-center rounded-full bg-success/10 text-success"
          >
            <CheckCircle2 className="size-8" aria-hidden />
          </motion.div>
          <div className="space-y-1">
            <h1 className="text-xl font-semibold">You&apos;re verified</h1>
            <p className="text-sm text-muted-foreground">
              Signed in as <span className="font-medium text-foreground">{maskEmail(email)}</span>. The
              dashboard arrives in the next phase.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <AuthHeader
        title={variant === '2fa' ? 'Two-factor authentication' : 'Enter the verification code'}
        subtitle={
          variant === '2fa'
            ? 'Enter the 6-digit code from your authenticator app.'
            : `We sent a ${OTP_LENGTH}-digit code to ${maskEmail(email)}. It expires in 5 minutes.`
        }
      />

      <Card>
        <CardContent className="space-y-5 p-6 sm:p-8">
          <FormAlert variant="error" message={error} />

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
              disabled={verifyOtp.isPending}
              invalid={!!error}
            />
          </motion.div>

          <LoadingButton
            type="button"
            className="w-full"
            onClick={() => submit(code)}
            disabled={code.length !== OTP_LENGTH}
            loading={verifyOtp.isPending}
            loadingText="Verifying…"
          >
            <ShieldCheck aria-hidden />
            Verify
          </LoadingButton>

          {variant === 'otp' ? (
            <p className="text-center text-sm text-muted-foreground" aria-live="polite">
              {countdown.isRunning ? (
                <>Resend available in <span className="font-medium tabular-nums">{countdown.formatted}</span></>
              ) : (
                <Button
                  type="button"
                  variant="link"
                  className="h-auto p-0 text-sm"
                  onClick={handleResend}
                  disabled={resendOtp.isPending}
                >
                  {resendOtp.isPending ? 'Sending…' : "Didn't get the code? Resend"}
                </Button>
              )}
            </p>
          ) : (
            <p className="text-center text-xs text-muted-foreground">
              Lost access to your authenticator? Contact your gym owner to reset 2FA.
            </p>
          )}
        </CardContent>
      </Card>

      <p className="text-center text-sm">
        <Button asChild variant="link" className="h-auto p-0 text-sm">
          <Link href={AUTH_ROUTES.login}>Use a different account</Link>
        </Button>
      </p>
    </div>
  );
}
