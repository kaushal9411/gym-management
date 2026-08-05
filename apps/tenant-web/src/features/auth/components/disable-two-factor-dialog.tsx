'use client';

import * as React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ShieldOff } from 'lucide-react';
import { toast } from 'sonner';

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoadingButton } from '@/components/ui/loading-button';
import { toAuthError, useDisableTwoFactor } from '../hooks/use-auth';
import { FormAlert } from './form-alert';

interface DisableTwoFactorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DisableTwoFactorDialog({ open, onOpenChange }: DisableTwoFactorDialogProps) {
  const queryClient = useQueryClient();
  const disable = useDisableTwoFactor();
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) {
      setPassword('');
      setError(null);
      disable.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only on close
  }, [open]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    disable.mutate(password, {
      onSuccess: () => {
        toast.success('Two-factor authentication disabled.');
        void queryClient.invalidateQueries({ queryKey: ['iam', 'profile'] });
        onOpenChange(false);
      },
      onError: (err) => setError(toAuthError(err).message),
    });
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !disable.isPending && onOpenChange(next)}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Disable two-factor authentication</DialogTitle>
          <DialogDescription>This removes the extra login step and deletes your backup codes. Enter your password to confirm.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <FormAlert variant="error" message={error} />
          <div className="space-y-2">
            <Label htmlFor="disable2faPassword">Password</Label>
            <Input id="disable2faPassword" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
          </div>
          <LoadingButton type="submit" variant="destructive" className="w-full" disabled={!password} loading={disable.isPending} loadingText="Disabling…">
            <ShieldOff aria-hidden /> Disable 2FA
          </LoadingButton>
        </form>
      </DialogContent>
    </Dialog>
  );
}
