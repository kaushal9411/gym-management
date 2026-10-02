'use client';

import { Copy } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

/** Shared "copy this secret, it won't be shown again" block — same shape as `RegenerateBackupCodesDialog`'s backup-code reveal, reused after both registering a new device and rotating an existing one's key. */
export function DeviceKeyReveal({ apiKey, deviceName, onDone }: { apiKey: string; deviceName: string; onDone: () => void }) {
  const copy = () => {
    void navigator.clipboard.writeText(apiKey);
    toast.success('API key copied to clipboard');
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{deviceName}&apos;s API key</DialogTitle>
        <DialogDescription>
          Paste this into the bridge agent&apos;s <code>.env</code> file (<code>DEVICE_API_KEY</code>) or the device&apos;s own cloud-push config. It won&apos;t be shown
          again — if you lose it, regenerate a new one.
        </DialogDescription>
      </DialogHeader>
      <div className="break-all rounded-lg border bg-muted/40 p-4 font-mono text-sm">{apiKey}</div>
      <Button type="button" variant="outline" className="w-full" onClick={copy}>
        <Copy aria-hidden /> Copy key
      </Button>
      <Button type="button" className="w-full" onClick={onDone}>
        Done
      </Button>
    </>
  );
}
