'use client';

import * as React from 'react';

import { Button, type ButtonProps } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

interface LoadingButtonProps extends ButtonProps {
  loading?: boolean;
  /** Announced + shown while loading; falls back to children. */
  loadingText?: string;
}

/** Submit button with built-in loading state — disabled while pending. */
export const LoadingButton = React.forwardRef<HTMLButtonElement, LoadingButtonProps>(
  ({ loading, loadingText, disabled, children, ...props }, ref) => (
    <Button ref={ref} disabled={disabled || loading} aria-busy={loading || undefined} {...props}>
      {loading ? (
        <>
          <Spinner label={loadingText ?? 'Submitting'} />
          {loadingText ?? children}
        </>
      ) : (
        children
      )}
    </Button>
  ),
);
LoadingButton.displayName = 'LoadingButton';
