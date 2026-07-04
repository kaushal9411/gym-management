'use client';

import * as React from 'react';

import { cn } from '@/lib/utils';
import { OTP_LENGTH } from '../constants';

interface OtpInputProps {
  value: string;
  onChange: (value: string) => void;
  /** Fired when all digits are filled — enables auto-submit. */
  onComplete?: (value: string) => void;
  disabled?: boolean;
  invalid?: boolean;
  length?: number;
  autoFocus?: boolean;
}

/**
 * Accessible 6-digit OTP input:
 *   • auto-advance on entry, backspace moves back
 *   • arrow-key navigation
 *   • full-code paste support (digits extracted from any clipboard text)
 *   • inputMode numeric + one-time-code autocomplete for mobile keyboards
 */
export function OtpInput({
  value,
  onChange,
  onComplete,
  disabled,
  invalid,
  length = OTP_LENGTH,
  autoFocus = true,
}: OtpInputProps) {
  const refs = React.useRef<Array<HTMLInputElement | null>>([]);
  const digits = Array.from({ length }, (_, i) => value[i] ?? '');

  const commit = (next: string) => {
    const clean = next.replace(/\D/g, '').slice(0, length);
    onChange(clean);
    if (clean.length === length) onComplete?.(clean);
  };

  const focusIndex = (index: number) => {
    refs.current[Math.max(0, Math.min(index, length - 1))]?.focus();
  };

  const handleChange = (index: number, raw: string) => {
    const digit = raw.replace(/\D/g, '').slice(-1);
    if (!digit) return;
    const next = value.slice(0, index) + digit + value.slice(index + 1);
    commit(next);
    focusIndex(index + 1);
  };

  const handleKeyDown = (index: number, event: React.KeyboardEvent<HTMLInputElement>) => {
    switch (event.key) {
      case 'Backspace': {
        event.preventDefault();
        if (digits[index]) {
          commit(value.slice(0, index) + value.slice(index + 1));
        } else {
          focusIndex(index - 1);
          commit(value.slice(0, Math.max(index - 1, 0)));
        }
        break;
      }
      case 'ArrowLeft':
        event.preventDefault();
        focusIndex(index - 1);
        break;
      case 'ArrowRight':
        event.preventDefault();
        focusIndex(index + 1);
        break;
      default:
        break;
    }
  };

  const handlePaste = (event: React.ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    const pasted = event.clipboardData.getData('text');
    commit(pasted);
    const filled = pasted.replace(/\D/g, '').slice(0, length).length;
    focusIndex(filled >= length ? length - 1 : filled);
  };

  return (
    <div
      className="flex justify-center gap-2"
      role="group"
      aria-label={`${length}-digit verification code`}
    >
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(el) => {
            refs.current[index] = el;
          }}
          value={digit}
          onChange={(e) => handleChange(index, e.target.value)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          onPaste={handlePaste}
          onFocus={(e) => e.target.select()}
          disabled={disabled}
          autoFocus={autoFocus && index === 0}
          inputMode="numeric"
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          maxLength={1}
          aria-label={`Digit ${index + 1} of ${length}`}
          aria-invalid={invalid || undefined}
          className={cn(
            'size-11 rounded-md border border-input bg-background text-center text-lg font-semibold shadow-sm transition-all duration-150 sm:size-12',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-ring focus-visible:scale-105',
            'disabled:cursor-not-allowed disabled:opacity-50',
            invalid && 'border-destructive focus-visible:ring-destructive',
          )}
        />
      ))}
    </div>
  );
}
