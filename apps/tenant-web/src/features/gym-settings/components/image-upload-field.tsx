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
  onUpload: (dataUrl: string) => void;
  /** Downscale target — small for logo/favicon, wider for banners/backgrounds. */
  maxDimension: number;
  previewClassName?: string;
  disabled?: boolean;
}

/** Reusable "upload with preview" field for every branding image slot (logo, favicon, login background, dashboard banner, email logo). */
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

  const handleFile = async (file: File | undefined) => {
    setError(null);
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Choose an image file.');
      return;
    }
    setUploading(true);
    try {
      onUpload(await fileToDataUrl(file, maxDimension));
    } catch {
      setError("Couldn't read that image — try another one.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{label}</p>
      {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      <div className="flex items-center gap-4">
        <div
          className={cn(
            'flex items-center justify-center overflow-hidden rounded-md border bg-muted/40',
            previewClassName ?? 'size-16',
          )}
        >
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element -- data: URL preview, not an optimizable remote asset
            <img src={value} alt={`${label} preview`} className="size-full object-contain" />
          ) : (
            <ImageUp className="size-6 text-muted-foreground" aria-hidden />
          )}
        </div>
        <div className="space-y-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled || uploading}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? 'Uploading…' : value ? 'Change image' : 'Upload image'}
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
