'use client';

import * as React from 'react';
import { Camera, CameraOff } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const SCANNER_ELEMENT_ID = 'attendance-qr-scanner';

interface QrScannerProps {
  /** Called with the decoded QR text (the member's opaque token) — camera scan or manual paste. */
  onDecoded: (value: string) => void;
  disabled?: boolean;
}

/**
 * Camera-based QR scanner (html5-qrcode) with a manual paste-token fallback
 * — some devices have no camera, a code can be damaged/unreadable, or a
 * test/CI run has no camera permission at all, so the same "validate this
 * token" path stays reachable either way.
 */
export function QrScanner({ onDecoded, disabled }: QrScannerProps) {
  const [cameraActive, setCameraActive] = React.useState(false);
  const [cameraError, setCameraError] = React.useState<string | null>(null);
  const [manualToken, setManualToken] = React.useState('');
  const scannerRef = React.useRef<import('html5-qrcode').Html5Qrcode | null>(null);

  const stopCamera = React.useCallback(async () => {
    const scanner = scannerRef.current;
    scannerRef.current = null;
    if (scanner) {
      try {
        await scanner.stop();
        scanner.clear();
      } catch {
        // Already stopped/torn down — nothing to clean up.
      }
    }
    setCameraActive(false);
  }, []);

  React.useEffect(() => stopCamera as unknown as () => void, [stopCamera]);

  const startCamera = async () => {
    setCameraError(null);
    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      const scanner = new Html5Qrcode(SCANNER_ELEMENT_ID);
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (decodedText) => {
          onDecoded(decodedText);
        },
        undefined,
      );
      setCameraActive(true);
    } catch {
      setCameraError('Could not access the camera. Check permissions, or paste the QR token below instead.');
      setCameraActive(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {cameraActive ? (
          <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => void stopCamera()}>
            <CameraOff className="size-4" /> Stop camera
          </Button>
        ) : (
          <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => void startCamera()}>
            <Camera className="size-4" /> Start camera scan
          </Button>
        )}
        <div id={SCANNER_ELEMENT_ID} className={cameraActive ? 'mx-auto w-full max-w-xs overflow-hidden rounded-md border' : 'hidden'} />
        {cameraError ? <p className="text-sm text-destructive">{cameraError}</p> : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="manualQrToken">Or paste/enter the QR token</Label>
        <div className="flex gap-2">
          <Input
            id="manualQrToken"
            value={manualToken}
            disabled={disabled}
            onChange={(e) => setManualToken(e.target.value)}
            placeholder="e.g. n5sn-r5S9ts-Iy3kB_UgJw"
          />
          <Button
            type="button"
            disabled={disabled || !manualToken.trim()}
            onClick={() => {
              onDecoded(manualToken.trim());
              setManualToken('');
            }}
          >
            Validate
          </Button>
        </div>
      </div>
    </div>
  );
}
