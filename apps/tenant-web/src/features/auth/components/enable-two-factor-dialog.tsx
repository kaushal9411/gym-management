'use client';

import * as React from 'react';
import { CheckCircle2, Copy, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { LoadingButton } from '@/components/ui/loading-button';
import { useQueryClient } from '@tanstack/react-query';
import { OTP_LENGTH } from '../constants';
import { toAuthError, useConfirmTwoFactorSetup } from '../hooks/use-auth';
import { otpSchema } from '../schemas';
import { authService } from '../services/auth.service';
import type { TwoFactorSetup } from '../types';
import { FormAlert } from './form-alert';
import { OtpInput } from './otp-input';

interface EnableTwoFactorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Local begin-setup state — deliberately NOT `useMutation`, same reasoning
 * as `mfa-setup-form.tsx`'s `BeginSetup` type: a mount/open-effect-fired
 * TanStack mutation can leave its observer stuck `pending` forever under
 * React StrictMode's double-invoked effects even though the request itself
 * succeeded — confirmed live for this exact dialog before the fix.
 */
type BeginSetup = { status: 'idle' } | { status: 'pending' } | { status: 'success'; data: TwoFactorSetup } | { status: 'error'; message: string };

/** Self-service setup — same begin/confirm engine as the mandatory-setup grace flow (`mfa-setup-form.tsx`), presented as a dialog instead of a full page since the user is already signed in. */
export function EnableTwoFactorDialog({ open, onOpenChange }: EnableTwoFactorDialogProps) {
  const queryClient = useQueryClient();
  const confirmSetup = useConfirmTwoFactorSetup();

  const [code, setCode] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [backupCodes, setBackupCodes] = React.useState<string[] | null>(null);
  const [savedConfirmed, setSavedConfirmed] = React.useState(false);
  const [beginSetup, setBeginSetup] = React.useState<BeginSetup>({ status: 'idle' });
  const startedRef = React.useRef(false);

  React.useEffect(() => {
    if (!open) {
      // Reset for next time the dialog opens.
      startedRef.current = false;
      setBeginSetup({ status: 'idle' });
      confirmSetup.reset();
      setCode('');
      setError(null);
      setBackupCodes(null);
      setSavedConfirmed(false);
      return;
    }
    if (startedRef.current) return;
    startedRef.current = true;
    setBeginSetup({ status: 'pending' });
    authService
      .beginTwoFactorSetup()
      .then((data) => setBeginSetup({ status: 'success', data }))
      .catch((err) => setBeginSetup({ status: 'error', message: toAuthError(err).message }));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fire exactly once per dialog open
  }, [open]);

  const submit = (value: string) => {
    const parsed = otpSchema.safeParse(value);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Enter the complete code');
      return;
    }
    setError(null);
    confirmSetup.mutate(parsed.data, {
      onSuccess: (result) => {
        setBackupCodes(result.backupCodes);
        void queryClient.invalidateQueries({ queryKey: ['iam', 'profile'] });
      },
      onError: (err) => {
        setError(toAuthError(err).message);
        setCode('');
      },
    });
  };

  const copyBackupCodes = () => {
    if (!backupCodes) return;
    void navigator.clipboard.writeText(backupCodes.join('\n'));
    toast.success('Backup codes copied to clipboard');
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !confirmSetup.isPending && onOpenChange(next)}>
      <DialogContent className="max-w-sm">
        {backupCodes ? (
          <>
            <DialogHeader>
              <DialogTitle>Save your backup codes</DialogTitle>
              <DialogDescription>Each code works once — use one if you ever lose access to your authenticator app.</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-2 rounded-lg border bg-muted/40 p-4 font-mono text-sm">
              {backupCodes.map((c) => (
                <span key={c}>{c}</span>
              ))}
            </div>
            <Button type="button" variant="outline" className="w-full" onClick={copyBackupCodes}>
              <Copy aria-hidden /> Copy codes
            </Button>
            <label htmlFor="settings-saved-confirm" className="flex items-start gap-2 text-sm">
              <Checkbox id="settings-saved-confirm" checked={savedConfirmed} onCheckedChange={(c) => setSavedConfirmed(c === true)} className="mt-0.5" />
              <span>I&apos;ve saved these codes somewhere safe.</span>
            </label>
            <Button type="button" className="w-full" disabled={!savedConfirmed} onClick={() => onOpenChange(false)}>
              <CheckCircle2 aria-hidden /> Done
            </Button>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Enable two-factor authentication</DialogTitle>
              <DialogDescription>Scan the QR code with an authenticator app, then enter the 6-digit code it shows.</DialogDescription>
            </DialogHeader>

            <FormAlert variant="error" message={error ?? (beginSetup.status === 'error' ? beginSetup.message : null)} />

            {beginSetup.status !== 'success' ? (
              <div className="flex items-center justify-center py-8">
                {beginSetup.status === 'pending' ? (
                  <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" aria-label="Loading" />
                ) : null}
              </div>
            ) : (
              <>
                <div className="flex justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element -- a one-time base64 data-URL from the API, not a static/optimizable asset */}
                  <img src={beginSetup.data.qrDataUrl} alt="Scan this QR code with your authenticator app" className="size-44 rounded-lg border p-2" />
                </div>
                <details className="text-center text-xs text-muted-foreground">
                  <summary className="cursor-pointer select-none">Can&apos;t scan? Enter this code manually</summary>
                  <p className="mt-2 break-all rounded-lg border bg-muted/40 p-2 font-mono">{beginSetup.data.secret}</p>
                </details>

                <OtpInput
                  value={code}
                  onChange={(next) => {
                    setCode(next);
                    if (error) setError(null);
                  }}
                  onComplete={submit}
                  disabled={confirmSetup.isPending}
                  invalid={!!error}
                  // eslint-disable-next-line jsx-a11y/no-autofocus -- deliberate: OVERRIDES OtpInput's own default (true) to false, since Radix's Dialog already focus-traps to its own first element and a second competing autofocus would fight it.
                  autoFocus={false}
                />

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
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
