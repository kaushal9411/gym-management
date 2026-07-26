'use client';

import * as React from 'react';

import { Button, type ButtonProps } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

interface LoadingButtonProps extends ButtonProps {
  loading?: boolean;
  /** Announced + shown while loading; falls back to children. */
  loadingText?: string;
}

/**
 * Submit/action button with a built-in loading state — disabled + spinner
 * while pending, restored automatically once the mutation settles (pass
 * `mutation.isPending` straight through). Moved here in Prompt 23 (Global
 * Loading & Performance Optimization) from `features/auth/components/` —
 * it was already the established pattern for every auth/billing/onboarding
 * form, just not promoted to the shared UI kit yet. This is now the
 * standard button-loading primitive for every action button in the app
 * (Save/Create/Update/Delete/Export/Import/etc.) — prefer it over the
 * older `disabled={mutation.isPending}` + manual text-swap convention for
 * any new or touched button.
 */
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
