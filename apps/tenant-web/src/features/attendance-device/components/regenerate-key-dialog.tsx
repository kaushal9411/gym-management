'use client';

import * as React from 'react';

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { LoadingButton } from '@/components/ui/loading-button';
import { toAttendanceDeviceError, useRegenerateAttendanceDeviceKey } from '../hooks/use-attendance-devices';
import type { AttendanceDevice, AttendanceDeviceWithKey } from '../types';
import { DeviceKeyReveal } from './device-key-reveal';

interface RegenerateKeyDialogProps {
  device: AttendanceDevice | null;
  onOpenChange: (open: boolean) => void;
}

export function RegenerateKeyDialog({ device, onOpenChange }: RegenerateKeyDialogProps) {
  const regenerate = useRegenerateAttendanceDeviceKey();
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<AttendanceDeviceWithKey | null>(null);

  React.useEffect(() => {
    if (!device) {
      setError(null);
      setResult(null);
      regenerate.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when the dialog closes
  }, [device]);

  const submit = () => {
    if (!device) return;
    setError(null);
    regenerate.mutate(device.id, {
      onSuccess: (updated) => setResult(updated),
      onError: (err) => setError(toAttendanceDeviceError(err).message),
    });
  };

  return (
    <Dialog open={!!device} onOpenChange={(next) => !regenerate.isPending && onOpenChange(next)}>
      <DialogContent className="max-w-sm">
        {result ? (
          <DeviceKeyReveal apiKey={result.apiKey} deviceName={result.name} onDone={() => onOpenChange(false)} />
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Regenerate {device?.name}&apos;s key?</DialogTitle>
              <DialogDescription>
                The old key stops working immediately — update the bridge agent&apos;s <code>.env</code> (or the device&apos;s own config) with the new one
                right after.
              </DialogDescription>
            </DialogHeader>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <LoadingButton type="button" className="w-full" onClick={submit} loading={regenerate.isPending} loadingText="Regenerating…">
              Regenerate key
            </LoadingButton>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
