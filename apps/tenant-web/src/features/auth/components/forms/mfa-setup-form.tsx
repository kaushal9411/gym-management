'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { CheckCircle2, Copy, KeyRound, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { LoadingButton } from '@/components/ui/loading-button';
import { AUTH_ROUTES, OTP_LENGTH, POST_LOGIN_REDIRECT } from '../../constants';
import { useConfirmMfaSetup, toAuthError } from '../../hooks/use-auth';
import { otpSchema } from '../../schemas';
import { authService } from '../../services/auth.service';
import type { TwoFactorSetup } from '../../types';
import { AuthHeader } from '../auth-header';
import { FormAlert } from '../form-alert';
import { OtpInput } from '../otp-input';

interface MfaSetupFormProps {
  email: string;
  setupToken: string;
}

/**
 * Local begin-setup state — deliberately NOT `useMutation`. Same class of
 * bug as `features/onboarding/components/steps/success-step.tsx`'s
 * `Provisioning` state: firing a TanStack mutation from a mount effect left
 * the observer stuck `pending` forever under React StrictMode's
 * double-invoked effects (confirmed live — the API call itself returned 200
 * every time, but the UI never left its loading spinner). A plain promise +
 * setState has no observer layer to lose the result.
 */
type BeginSetup = { status: 'pending' } | { status: 'success'; data: TwoFactorSetup } | { status: 'error'; message: string };

/**
 * The mandatory-2FA grace flow's setup screen — reached only from a
 * `mfa_setup_required` login challenge (password already verified). Begins
 * setup on mount (one fresh secret per visit — see `AuthService
 * #beginTwoFactorSetup`'s doc comment on why an abandoned attempt is
 * harmless), then confirming a real code both enables 2FA AND completes
 * login in the same request.
 */
export function MfaSetupForm({ email, setupToken }: MfaSetupFormProps) {
  const router = useRouter();
  const confirmSetup = useConfirmMfaSetup();

  const [code, setCode] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [shake, setShake] = React.useState(0);
  const [backupCodes, setBackupCodes] = React.useState<string[] | null>(null);
  const [savedConfirmed, setSavedConfirmed] = React.useState(false);
  const [beginSetup, setBeginSetup] = React.useState<BeginSetup>({ status: 'pending' });
  const startedRef = React.useRef(false);

  // Guard: this screen requires a pending setup-token context.
  React.useEffect(() => {
    if (!setupToken) router.replace(AUTH_ROUTES.login);
  }, [setupToken, router]);

  React.useEffect(() => {
    if (!setupToken || startedRef.current) return;
    // Fires exactly once — a fresh secret per visit, not idempotent-safe to silently retry.
    startedRef.current = true;
    authService
      .beginMfaSetup(setupToken)
      .then((data) => setBeginSetup({ status: 'success', data }))
      .catch((err) => setBeginSetup({ status: 'error', message: toAuthError(err).message }));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fire exactly once per mount
  }, [setupToken]);

  const submit = (value: string) => {
    const parsed = otpSchema.safeParse(value);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Enter the complete code');
      return;
    }
    setError(null);
    confirmSetup.mutate(
      { setupToken, code: parsed.data },
      {
        onSuccess: (result) => setBackupCodes(result.backupCodes),
        onError: (err) => {
          setError(toAuthError(err).message);
          setCode('');
          setShake((s) => s + 1);
        },
      },
    );
  };

  const copyBackupCodes = () => {
    if (!backupCodes) return;
    void navigator.clipboard.writeText(backupCodes.join('\n'));
    toast.success('Backup codes copied to clipboard');
  };

  if (backupCodes) {
    return (
      <div className="space-y-6">
        <AuthHeader title="Save your backup codes" subtitle="Each code works once — use one if you ever lose access to your authenticator app." />
        <Card>
          <CardContent className="space-y-5 p-6 sm:p-8">
            <div className="grid grid-cols-2 gap-2 rounded-lg border bg-muted/40 p-4 font-mono text-sm">
              {backupCodes.map((c) => (
                <span key={c}>{c}</span>
              ))}
            </div>
            <Button type="button" variant="outline" className="w-full" onClick={copyBackupCodes}>
              <Copy aria-hidden /> Copy codes
            </Button>
            <label htmlFor="saved-confirm" className="flex items-start gap-2 text-sm">
              <Checkbox id="saved-confirm" checked={savedConfirmed} onCheckedChange={(c) => setSavedConfirmed(c === true)} className="mt-0.5" />
              <span>I&apos;ve saved these codes somewhere safe. They won&apos;t be shown again.</span>
            </label>
            <Button type="button" className="w-full" disabled={!savedConfirmed} onClick={() => router.push(POST_LOGIN_REDIRECT)}>
              <CheckCircle2 aria-hidden /> Continue to dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AuthHeader
        title="Set up two-factor authentication"
        subtitle="Your gym now requires 2FA for this role. Scan the QR code with an authenticator app (Google Authenticator, Authy, 1Password, …), then enter the 6-digit code it shows."
      />

      <Card>
        <CardContent className="space-y-5 p-6 sm:p-8">
          <FormAlert variant="error" message={error ?? (beginSetup.status === 'error' ? beginSetup.message : null)} />

          {beginSetup.status !== 'success' ? (
            <div className="flex items-center justify-center py-10">
              {beginSetup.status === 'pending' ? (
                <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" aria-label="Loading" />
              ) : null}
            </div>
          ) : (
            <>
              <div className="flex justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element -- a one-time base64 data-URL from the API, not a static/optimizable asset */}
                <img src={beginSetup.data.qrDataUrl} alt="Scan this QR code with your authenticator app" className="size-48 rounded-lg border p-2" />
              </div>
              <details className="text-center text-xs text-muted-foreground">
                <summary className="cursor-pointer select-none">Can&apos;t scan? Enter this code manually</summary>
                <p className="mt-2 break-all rounded-lg border bg-muted/40 p-2 font-mono">{beginSetup.data.secret}</p>
              </details>

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
                  disabled={confirmSetup.isPending}
                  invalid={!!error}
                />
              </motion.div>

              <LoadingButton
                type="button"
                className="w-full"
                onClick={() => submit(code)}
                disabled={code.length !== OTP_LENGTH}
                loading={confirmSetup.isPending}
                loadingText="Verifying…"
              >
                <ShieldCheck aria-hidden />
                Enable 2FA
              </LoadingButton>
            </>
          )}
        </CardContent>
      </Card>

      <p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
        <KeyRound className="size-3.5" aria-hidden />
        Signed in as {email}
      </p>
      <p className="text-center text-sm">
        <Button asChild variant="link" className="h-auto p-0 text-sm">
          <Link href={AUTH_ROUTES.login}>Cancel and use a different account</Link>
        </Button>
      </p>
    </div>
  );
}
