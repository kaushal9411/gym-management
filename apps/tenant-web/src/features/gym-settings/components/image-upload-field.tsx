'use client';

import * as React from 'react';
import { ImageUp } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { fileToDataUrl } from '@/lib/image-to-data-url';
import { cn } from '@/lib/utils';

interface ImageUploadFieldProps {
  label: string;
  description?: string;
  value: string | null;
  /** Resolves once the upload (network included) is fully done. Call `onProgress(0-100)` as the upload streams to report real progress on the thumbnail. */
  onUpload: (dataUrl: string, onProgress: (percent: number) => void) => Promise<void>;
  /** Downscale target — small for logo/favicon, wider for banners/backgrounds. */
  maxDimension: number;
  previewClassName?: string;
  disabled?: boolean;
}

/**
 * Reusable "upload with preview" field for every branding image slot (logo,
 * favicon, login background, dashboard banner, email logo). Shows upload
 * progress IN PLACE on the thumbnail (Prompt 33) — the request itself is
 * marked `silent: true` at the call site so it never triggers the app's
 * global full-screen loader, which would otherwise cover this same
 * thumbnail (and every other "Change image" button on the page) for the
 * whole upload, which is exactly the user-reported complaint this fixes.
 */
export function ImageUploadField({
  label,
  description,
  value,
  onUpload,
  maxDimension,
  previewClassName,
  disabled,
}: ImageUploadFieldProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const [progress, setProgress] = React.useState(0);

  const handleFile = async (file: File | undefined) => {
    setError(null);
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Choose an image file.');
      return;
    }
    setUploading(true);
    setProgress(0);
    try {
      const dataUrl = await fileToDataUrl(file, maxDimension);
      await onUpload(dataUrl, setProgress);
    } catch {
      setError("Couldn't read or upload that image — try another one.");
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{label}</p>
      {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      <div className="flex items-center gap-4">
        <div
          className={cn(
            'relative flex items-center justify-center overflow-hidden rounded-xl border border-dashed bg-muted/30 shadow-xs transition-colors duration-150',
            value && 'border-solid bg-muted/10',
            previewClassName ?? 'size-16',
          )}
        >
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element -- data: URL preview, not an optimizable remote asset
            <img src={value} alt={`${label} preview`} className="size-full object-contain" />
          ) : (
            <ImageUp className="size-6 text-muted-foreground/60" aria-hidden />
          )}
          {uploading ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-background/85 backdrop-blur-[1px]">
              <div className="h-1 w-3/4 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary transition-[width] duration-150" style={{ width: `${progress}%` }} />
              </div>
              <span className="text-[10px] font-semibold tabular-nums text-muted-foreground">{progress}%</span>
            </div>
          ) : null}
        </div>
        <div className="space-y-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled || uploading}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? `Uploading… ${progress}%` : value ? 'Change image' : 'Upload image'}
          </Button>
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              void handleFile(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </div>
      </div>
    </div>
  );
}
