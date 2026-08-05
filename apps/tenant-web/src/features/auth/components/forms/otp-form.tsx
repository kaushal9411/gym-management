'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ShieldCheck } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { AUTH_ROUTES, OTP_LENGTH, OTP_RESEND_COOLDOWN_SECONDS, POST_LOGIN_REDIRECT } from '../../constants';
import { toAuthError, useResendOtp, useVerifyOtp } from '../../hooks/use-auth';
import { useCountdown } from '../../hooks/use-countdown';
import { otpSchema } from '../../schemas';
import type { OtpFlow } from '../../types';
import { maskEmail } from '../../utils/mask';
import { AuthHeader } from '../auth-header';
import { FormAlert } from '../form-alert';
import { LoadingButton } from '@/components/ui/loading-button';
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
  const [shake, setShake] = React.useState(0);
  const [useBackupCode, setUseBackupCode] = React.useState(false);
  const [backupCode, setBackupCode] = React.useState('');

  // Guard: this screen requires a pending challenge context.
  React.useEffect(() => {
    if (!email) router.replace(AUTH_ROUTES.login);
  }, [email, router]);

  const onVerifySuccess = () => {
    toast.success('Verification successful');
    router.push(POST_LOGIN_REDIRECT);
  };

  const onVerifyError = (err: unknown, resetField: () => void) => {
    const authError = toAuthError(err);
    setError(authError.message);
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
    verifyOtp.mutate(
      { email, code: parsed.data, flow },
      { onSuccess: onVerifySuccess, onError: (err) => onVerifyError(err, () => setCode('')) },
    );
  };

  const submitBackupCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!backupCode.trim()) return;
    setError(null);
    verifyOtp.mutate(
      { email, code: backupCode.trim(), flow },
      { onSuccess: onVerifySuccess, onError: (err) => onVerifyError(err, () => setBackupCode('')) },
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

          {variant === '2fa' && useBackupCode ? (
            <form onSubmit={submitBackupCode} className="space-y-5">
              <Input
                value={backupCode}
                onChange={(e) => {
                  setBackupCode(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="XXXX-XXXXXX"
                autoComplete="off"
                // eslint-disable-next-line jsx-a11y/no-autofocus -- deliberate: the sole field on this alternate-entry mode, entered right after the user explicitly chose "Use a backup code instead".
                autoFocus
                disabled={verifyOtp.isPending}
                aria-invalid={!!error}
                className="text-center font-mono tracking-wider"
              />
              <LoadingButton type="submit" className="w-full" disabled={!backupCode.trim()} loading={verifyOtp.isPending} loadingText="Verifying…">
                <ShieldCheck aria-hidden />
                Verify
              </LoadingButton>
            </form>
          ) : (
            <>
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
            </>
          )}

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
              <Button
                type="button"
                variant="link"
                className="h-auto p-0 text-xs"
                onClick={() => {
                  setUseBackupCode((v) => !v);
                  setError(null);
                  setCode('');
                  setBackupCode('');
                }}
              >
                {useBackupCode ? 'Use my authenticator app instead' : 'Use a backup code instead'}
              </Button>
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
