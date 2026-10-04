'use client';

import * as React from 'react';
import Link from 'next/link';
import { BadgeCheck, MailQuestion, MailWarning, Send } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { OTP_RESEND_COOLDOWN_SECONDS, AUTH_ROUTES } from '../../constants';
import { useResendVerification, useVerifyEmail } from '../../hooks/use-auth';
import { useCountdown } from '../../hooks/use-countdown';
import { maskEmail } from '../../utils/mask';
import { CountdownRing, PanelSpinner } from '../auth-panel';
import { StatusScreen } from '../status-screen';

interface VerifyEmailViewProps {
  token: string;
  /** 'pending' = “check your inbox” (post-registration), no token yet. */
  status: string;
  email: string;
}

function ResendButton({ email }: { email: string }) {
  const resend = useResendVerification();
  const countdown = useCountdown(0);

  const handleResend = () => {
    resend.mutate(email, {
      onSuccess: () => {
        toast.success('Verification email sent');
        countdown.restart(OTP_RESEND_COOLDOWN_SECONDS);
      },
    });
  };

  return (
    <Button
      variant="outline"
      className="w-full sm:w-auto"
      onClick={handleResend}
      disabled={resend.isPending || countdown.isRunning}
    >
      {countdown.isRunning ? <CountdownRing remaining={countdown.secondsLeft} total={OTP_RESEND_COOLDOWN_SECONDS} /> : <Send aria-hidden />}
      {countdown.isRunning ? `Resend in ${countdown.formatted}` : 'Resend verification email'}
    </Button>
  );
}

export function VerifyEmailView({ token, status, email }: VerifyEmailViewProps) {
  const verification = useVerifyEmail(status === 'pending' ? '' : token);

  // Post-registration: no token yet, tell the user to check their inbox.
  if (status === 'pending' || !token) {
    return (
      <StatusScreen
        icon={MailQuestion}
        tone="neutral"
        title="Verify your email"
        description={
          email
            ? `We sent a verification link to ${maskEmail(email)}. Click it to activate your account.`
            : 'We sent you a verification link. Click it to activate your account.'
        }
        steps={[
          { label: 'Open the email we sent', hint: 'Check spam or promotions if you don\'t see it', state: 'active' },
          { label: 'Click the verification link', state: 'pending' },
          { label: 'Sign in to your account', state: 'pending' },
        ]}
        footnote="The link expires in 24 hours."
      >
        {email ? <ResendButton email={email} /> : null}
        <Button asChild variant="ghost" className="w-full sm:w-auto">
          <Link href={AUTH_ROUTES.login}>Back to login</Link>
        </Button>
      </StatusScreen>
    );
  }

  if (verification.isPending) {
    return (
      <div className="rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
        <PanelSpinner label="Verifying your email…" />
      </div>
    );
  }

  const result = verification.data ?? 'invalid';

  if (result === 'verified' || result === 'already_verified') {
    return (
      <StatusScreen
        icon={BadgeCheck}
        tone="success"
        title={result === 'verified' ? 'Email verified' : 'Already verified'}
        description="Your email address is confirmed. You can sign in to your account now."
      >
        <Button asChild className="w-full sm:w-auto">
          <Link href={AUTH_ROUTES.login}>Continue to login</Link>
        </Button>
      </StatusScreen>
    );
  }

  return (
    <StatusScreen
      icon={MailWarning}
      tone="warning"
      title={result === 'expired' ? 'Verification link expired' : 'Invalid verification link'}
      description={
        result === 'expired'
          ? 'This link is older than 24 hours. Request a fresh one and try again.'
          : 'This link is not valid. It may have been truncated by your email client.'
      }
    >
      {email ? <ResendButton email={email} /> : null}
      <Button asChild variant="ghost" className="w-full sm:w-auto">
        <Link href={AUTH_ROUTES.login}>Back to login</Link>
      </Button>
    </StatusScreen>
  );
}
