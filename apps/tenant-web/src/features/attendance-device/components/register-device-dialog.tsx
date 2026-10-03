'use client';

import * as React from 'react';
import { Fingerprint } from 'lucide-react';
import { toast } from 'sonner';

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoadingButton } from '@/components/ui/loading-button';
import { useBranches } from '@/features/branch/hooks/use-branches';
import { cn } from '@/lib/utils';
import { toAttendanceDeviceError, useCreateAttendanceDevice } from '../hooks/use-attendance-devices';
import type { AttendanceDeviceVendor, AttendanceDeviceWithKey } from '../types';
import { DeviceKeyReveal } from './device-key-reveal';

const selectClassName = cn(
  'h-9 w-full rounded-lg border border-input bg-background px-2 text-sm shadow-xs',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:border-ring',
);

interface RegisterDeviceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RegisterDeviceDialog({ open, onOpenChange }: RegisterDeviceDialogProps) {
  const branches = useBranches();
  const createDevice = useCreateAttendanceDevice();
  const [name, setName] = React.useState('');
  const [branchId, setBranchId] = React.useState('');
  const [vendor, setVendor] = React.useState<AttendanceDeviceVendor>('ZKTECO');
  const [error, setError] = React.useState<string | null>(null);
  const [created, setCreated] = React.useState<AttendanceDeviceWithKey | null>(null);

  React.useEffect(() => {
    if (!open) {
      setName('');
      setBranchId('');
      setVendor('ZKTECO');
      setError(null);
      setCreated(null);
      createDevice.reset();
    } else if (!branchId && branches.data && branches.data.length > 0) {
      setBranchId(branches.data.find((b) => b.isDefault)?.id ?? branches.data[0]!.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only on open/close + default branch once loaded
  }, [open, branches.data]);

  const submit = () => {
    if (!name.trim()) {
      setError('Give the device a name, e.g. "Front Desk Reader".');
      return;
    }
    if (!branchId) {
      setError('Select which branch this device is at.');
      return;
    }
    setError(null);
    createDevice.mutate(
      { branchId, name: name.trim(), vendor },
      {
        onSuccess: (device) => setCreated(device),
        onError: (err) => setError(toAttendanceDeviceError(err).message),
      },
    );
  };

  const close = () => {
    onOpenChange(false);
    if (created) toast.success(`${created.name} registered.`);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !createDevice.isPending && onOpenChange(next)}>
      <DialogContent className={created ? 'max-w-sm' : 'max-w-sm gap-0 overflow-hidden p-0'}>
        {created ? (
          <DeviceKeyReveal apiKey={created.apiKey} deviceName={created.name} onDone={close} />
        ) : (
          <>
            <div className="relative overflow-hidden p-5 text-white" style={{ backgroundImage: 'linear-gradient(115deg, #4338ca, #7c3aed 62%, #c026d3)' }}>
              <div aria-hidden className="pointer-events-none absolute inset-0 opacity-60" style={{ backgroundImage: 'repeating-linear-gradient(135deg, rgba(255,255,255,.06) 0 1px, transparent 1px 14px)' }} />
              <div className="relative flex items-center gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-white/15 border border-white/30">
                  <Fingerprint className="size-5" aria-hidden />
                </span>
                <DialogHeader className="min-w-0">
                  <DialogTitle className="text-white">Register a fingerprint reader</DialogTitle>
                  <DialogDescription className="text-white/80">
                    Gives the device (or a local bridge agent polling it) an API key to record check-ins/check-outs directly.
                  </DialogDescription>
                </DialogHeader>
              </div>
            </div>
            <div className="space-y-4 p-5">
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
              <div className="space-y-2">
                <Label htmlFor="deviceName">Device name</Label>
                <Input id="deviceName" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Front Desk Reader" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="deviceBranch">Branch</Label>
                <select id="deviceBranch" className={selectClassName} value={branchId} onChange={(e) => setBranchId(e.target.value)}>
                  {!branches.data?.length ? <option value="">Loading…</option> : null}
                  {branches.data?.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="deviceVendor">Vendor</Label>
                <select id="deviceVendor" className={selectClassName} value={vendor} onChange={(e) => setVendor(e.target.value as AttendanceDeviceVendor)}>
                  <option value="ZKTECO">ZKTeco</option>
                  <option value="ESSL">eSSL</option>
                  <option value="GENERIC">Generic</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
              <LoadingButton
                type="button"
                className="w-full border-0 text-white shadow-md"
                style={{ backgroundImage: 'linear-gradient(120deg, var(--success), var(--chart-3))' }}
                onClick={submit}
                loading={createDevice.isPending}
                loadingText="Registering…"
              >
                Register device
              </LoadingButton>
              <p className="text-xs text-muted-foreground">
                See the member profile&apos;s &quot;Fingerprint check-in&quot; field to enroll individual members afterward.
              </p>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
