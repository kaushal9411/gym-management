'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const HEX_PATTERN = /^#[0-9a-fA-F]{6}$/;

interface ColorPickerProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

/**
 * Native <input type="color"> only understands #rrggbb, but this codebase
 * also stores oklch()/rgb()/named colors (see prisma seed) — so the swatch
 * is a convenience for hex values, while the text field always accepts and
 * submits the raw string as typed, whatever format it's in.
 */
export function ColorPicker({ id, label, value, onChange, disabled }: ColorPickerProps) {
  const swatchValue = HEX_PATTERN.test(value) ? value : '#808080';

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={`${label} swatch`}
          value={swatchValue}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className="size-10 shrink-0 cursor-pointer rounded-md border border-input bg-background p-1 disabled:cursor-not-allowed disabled:opacity-50"
        />
        <Input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder="#4f46e5 or oklch(0.51 0.23 277)"
          className="font-mono text-sm"
        />
      </div>
    </div>
  );
}
