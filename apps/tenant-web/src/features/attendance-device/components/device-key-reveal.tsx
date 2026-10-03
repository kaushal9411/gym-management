'use client';

import { CheckCircle2, Copy, KeyRound } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { tint } from '@/features/members/components/detail/detail-ui';

/** Shared "copy this secret, it won't be shown again" block — same shape as `RegenerateBackupCodesDialog`'s backup-code reveal, reused after both registering a new device and rotating an existing one's key. */
export function DeviceKeyReveal({ apiKey, deviceName, onDone }: { apiKey: string; deviceName: string; onDone: () => void }) {
  const copy = () => {
    void navigator.clipboard.writeText(apiKey);
    toast.success('API key copied to clipboard');
  };

  return (
    <>
      <div className="relative overflow-hidden rounded-xl p-5 text-white" style={{ backgroundImage: 'linear-gradient(120deg, var(--success), var(--chart-3))' }}>
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-60" style={{ backgroundImage: 'repeating-linear-gradient(135deg, rgba(255,255,255,.1) 0 1px, transparent 1px 14px)' }} />
        <div className="relative flex items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full border border-white/30 bg-white/15">
            <CheckCircle2 className="size-5" aria-hidden />
          </span>
          <DialogHeader className="min-w-0 text-left">
            <DialogTitle className="text-white">{deviceName}&apos;s API key</DialogTitle>
          </DialogHeader>
        </div>
      </div>
      <DialogDescription>
        Paste this into the bridge agent&apos;s <code>.env</code> file (<code>DEVICE_API_KEY</code>) or the device&apos;s own cloud-push config. It won&apos;t be shown
        again — if you lose it, regenerate a new one.
      </DialogDescription>
      <div className="flex items-center gap-2 break-all rounded-xl border p-4 font-mono text-sm" style={{ backgroundColor: tint('success', 8), borderColor: tint('success', 22) }}>
        <KeyRound className="size-4 shrink-0" style={{ color: 'var(--success)' }} aria-hidden />
        {apiKey}
      </div>
      <Button type="button" variant="outline" className="w-full" onClick={copy}>
        <Copy aria-hidden /> Copy key
      </Button>
      <Button type="button" className="w-full border-0 text-white shadow-md" style={{ backgroundImage: 'linear-gradient(120deg, var(--primary), var(--chart-7))' }} onClick={onDone}>
        Done
      </Button>
    </>
  );
}
