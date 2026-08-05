'use client';

import * as React from 'react';
import { Copy, KeyRound } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { LoadingButton } from '@/components/ui/loading-button';
import { OTP_LENGTH } from '../constants';
import { toAuthError, useRegenerateBackupCodes } from '../hooks/use-auth';
import { otpSchema } from '../schemas';
import { FormAlert } from './form-alert';
import { OtpInput } from './otp-input';

interface RegenerateBackupCodesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RegenerateBackupCodesDialog({ open, onOpenChange }: RegenerateBackupCodesDialogProps) {
  const regenerate = useRegenerateBackupCodes();
  const [code, setCode] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [backupCodes, setBackupCodes] = React.useState<string[] | null>(null);

  React.useEffect(() => {
    if (!open) {
      setCode('');
      setError(null);
      setBackupCodes(null);
      regenerate.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only on close
  }, [open]);

  const submit = (value: string) => {
    const parsed = otpSchema.safeParse(value);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Enter the complete code');
      return;
    }
    setError(null);
    regenerate.mutate(parsed.data, {
      onSuccess: (result) => setBackupCodes(result.backupCodes),
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
    <Dialog open={open} onOpenChange={(next) => !regenerate.isPending && onOpenChange(next)}>
      <DialogContent className="max-w-sm">
        {backupCodes ? (
          <>
            <DialogHeader>
              <DialogTitle>New backup codes</DialogTitle>
              <DialogDescription>Your old codes no longer work. Save these somewhere safe.</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-2 rounded-lg border bg-muted/40 p-4 font-mono text-sm">
              {backupCodes.map((c) => (
                <span key={c}>{c}</span>
              ))}
            </div>
            <Button type="button" variant="outline" className="w-full" onClick={copyBackupCodes}>
              <Copy aria-hidden /> Copy codes
            </Button>
            <Button type="button" className="w-full" onClick={() => onOpenChange(false)}>
              Done
            </Button>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Regenerate backup codes</DialogTitle>
              <DialogDescription>Enter a current code from your authenticator app to confirm — this invalidates your existing backup codes.</DialogDescription>
            </DialogHeader>
            <FormAlert variant="error" message={error} />
            <OtpInput
              value={code}
              onChange={(next) => {
                setCode(next);
                if (error) setError(null);
              }}
              onComplete={submit}
              disabled={regenerate.isPending}
              invalid={!!error}
              // eslint-disable-next-line jsx-a11y/no-autofocus -- deliberate: OVERRIDES OtpInput's own default (true) to false, since Radix's Dialog already focus-traps to its own first element and a second competing autofocus would fight it.
              autoFocus={false}
            />
            <LoadingButton
              type="button"
              className="w-full"
              onClick={() => submit(code)}
              disabled={code.length !== OTP_LENGTH}
              loading={regenerate.isPending}
              loadingText="Verifying…"
            >
              <KeyRound aria-hidden /> Regenerate codes
            </LoadingButton>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
