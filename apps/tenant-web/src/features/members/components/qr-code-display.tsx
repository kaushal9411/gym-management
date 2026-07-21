'use client';

import { RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { toMemberError, useRegenerateQrCode } from '../hooks/use-members';

interface QrCodeDisplayProps {
  memberId: string;
  qrCodeImageUrl: string | null;
  canRegenerate?: boolean;
}

/** For future attendance check-in — scanning resolves the encoded token back to this member. */
export function QrCodeDisplay({ memberId, qrCodeImageUrl, canRegenerate }: QrCodeDisplayProps) {
  const regenerate = useRegenerateQrCode();

  return (
    <div className="flex items-center gap-4">
      {qrCodeImageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- data-URL, not an optimizable remote image
        <img src={qrCodeImageUrl} alt="Member QR code" className="size-32 rounded-lg border bg-white p-2" />
      ) : (
        <div className="flex size-32 items-center justify-center rounded-lg border text-xs text-muted-foreground">No QR code</div>
      )}
      {canRegenerate ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={regenerate.isPending}
          onClick={() =>
            regenerate.mutate(memberId, {
              onSuccess: () => toast.success('QR code regenerated'),
              onError: (err) => toast.error(toMemberError(err).message),
            })
          }
        >
          <RefreshCw className="size-4" /> {regenerate.isPending ? 'Regenerating…' : 'Regenerate QR code'}
        </Button>
      ) : null}
    </div>
  );
}
