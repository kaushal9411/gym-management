'use client';

import * as React from 'react';
import { KeyRound } from 'lucide-react';

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
      <DialogContent className={result ? 'max-w-sm' : 'max-w-sm gap-0 overflow-hidden p-0'}>
        {result ? (
          <DeviceKeyReveal apiKey={result.apiKey} deviceName={result.name} onDone={() => onOpenChange(false)} />
        ) : (
          <>
            <div className="relative overflow-hidden p-5 text-white" style={{ backgroundImage: 'linear-gradient(115deg, #4338ca, #7c3aed 62%, #c026d3)' }}>
              <div aria-hidden className="pointer-events-none absolute inset-0 opacity-60" style={{ backgroundImage: 'repeating-linear-gradient(135deg, rgba(255,255,255,.06) 0 1px, transparent 1px 14px)' }} />
              <div className="relative flex items-center gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-full border border-white/30 bg-white/15">
                  <KeyRound className="size-5" aria-hidden />
                </span>
                <DialogHeader className="min-w-0">
                  <DialogTitle className="text-white">Regenerate {device?.name}&apos;s key?</DialogTitle>
                  <DialogDescription className="text-white/80">
                    The old key stops working immediately — update the bridge agent&apos;s <code>.env</code> (or the device&apos;s own config) with the new one
                    right after.
                  </DialogDescription>
                </DialogHeader>
              </div>
            </div>
            <div className="space-y-4 p-5">
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
              <LoadingButton
                type="button"
                className="w-full border-0 text-white shadow-md"
                style={{ backgroundImage: 'linear-gradient(120deg, var(--warning), var(--chart-5))' }}
                onClick={submit}
                loading={regenerate.isPending}
                loadingText="Regenerating…"
              >
                Regenerate key
              </LoadingButton>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
