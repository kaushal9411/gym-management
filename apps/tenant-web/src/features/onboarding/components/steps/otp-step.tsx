'use client';

import * as React from 'react';
import { ShieldCheck } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { FormAlert } from '@/features/auth/components/form-alert';
import { LoadingButton } from '@/features/auth/components/loading-button';
import { OtpInput } from '@/features/auth/components/otp-input';
import { useCountdown } from '@/features/auth/hooks/use-countdown';
import { OTP_RESEND_COOLDOWN_SECONDS } from '../../constants';
import { toOnboardingError, useResendOnboardingOtp, useVerifyOnboardingOtp } from '../../hooks/use-onboarding';
import { onboardingOtpSchema } from '../../schemas';
import { useOnboardingWizard } from '../../store/onboarding-wizard-context';

/** Step 2 — verify the OTP emailed after account creation. */
export function OtpStep() {
  const { state, dispatch } = useOnboardingWizard();
  const verifyOtp = useVerifyOnboardingOtp();
  const resendOtp = useResendOnboardingOtp();
  const countdown = useCountdown(OTP_RESEND_COOLDOWN_SECONDS);

  const [code, setCode] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [shake, setShake] = React.useState(0);

  const sessionId = state.sessionId;

  const submit = (value: string) => {
    if (!sessionId) return;
    const parsed = onboardingOtpSchema.shape.code.safeParse(value);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Enter the complete code');
      return;
    }
    setError(null);
    verifyOtp.mutate(
      { sessionId, code: parsed.data },
      {
        onSuccess: () => {
          toast.success('Email verified');
          dispatch({ type: 'OTP_VERIFIED' });
        },
        onError: (err) => {
          const onboardingError = toOnboardingError(err);
          setError(onboardingError.message);
          setCode('');
          setShake((s) => s + 1);
        },
      },
    );
  };

  const handleResend = () => {
    if (!sessionId) return;
    resendOtp.mutate(sessionId, {
      onSuccess: () => {
        toast.success(`A new code was sent to ${state.maskedEmail ?? 'your email'}`);
        countdown.restart(OTP_RESEND_COOLDOWN_SECONDS);
        setCode('');
        setError(null);
      },
      onError: (err) => {
        toast.error(toOnboardingError(err).message);
      },
    });
  };

  if (!sessionId) {
    return (
      <FormAlert
        variant="error"
        message="Your session has expired. Please start again from the account details step."
      />
    );
  }

  return (
    <div className="space-y-5">
      <p className="text-center text-sm text-muted-foreground">
        We sent a 6-digit code to <span className="font-medium text-foreground">{state.maskedEmail}</span>. It expires in
        5 minutes.
      </p>

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
        disabled={code.length !== 6}
        loading={verifyOtp.isPending}
        loadingText="Verifying…"
      >
        <ShieldCheck aria-hidden />
        Verify email
      </LoadingButton>

      <p className="text-center text-sm text-muted-foreground" aria-live="polite">
        {countdown.isRunning ? (
          <>Resend available in <span className="font-medium tabular-nums">{countdown.formatted}</span></>
        ) : (
          <Button type="button" variant="link" className="h-auto p-0 text-sm" onClick={handleResend} disabled={resendOtp.isPending}>
            {resendOtp.isPending ? 'Sending…' : "Didn't get the code? Resend"}
          </Button>
        )}
      </p>
    </div>
  );
}
