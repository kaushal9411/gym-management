'use client';

import * as React from 'react';
import { Camera, Trash2 } from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { fileToDataUrl } from '@/lib/image-to-data-url';

const MAX_DIMENSION = 192;

interface AvatarUploadProps {
  name: string;
  value: string | null;
  onChange: (dataUrl: string | null) => void;
  disabled?: boolean;
}

export function AvatarUpload({ name, value, onChange, disabled }: AvatarUploadProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [error, setError] = React.useState<string | null>(null);

  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const handleFile = async (file: File | undefined) => {
    setError(null);
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Choose an image file.');
      return;
    }
    try {
      onChange(await fileToDataUrl(file, MAX_DIMENSION));
    } catch {
      setError("Couldn't read that image — try another one.");
    }
  };

  return (
    <div className="flex items-center gap-4">
      <Avatar className="size-16">
        {value ? <AvatarImage src={value} alt={`${name} avatar`} /> : null}
        <AvatarFallback className="text-lg">{initials || '?'}</AvatarFallback>
      </Avatar>
      <div className="space-y-1.5">
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => inputRef.current?.click()}>
            <Camera className="size-4" />
            {value ? 'Change photo' : 'Upload photo'}
          </Button>
          {value ? (
            <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={() => onChange(null)}>
              <Trash2 className="size-4" />
              Remove
            </Button>
          ) : null}
        </div>
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => void handleFile(e.target.files?.[0])}
        />
      </div>
    </div>
  );
}
