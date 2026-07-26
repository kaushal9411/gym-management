'use client';

import * as React from 'react';

interface UseSubmitHandlerResult<Args extends unknown[]> {
  isSubmitting: boolean;
  error: string | null;
  setError: (message: string | null) => void;
  /** Runs `action`, guarding against a duplicate concurrent call even in the brief window before React re-renders to disable the trigger button. Swallows and stores thrown errors as a message; never resets `isSubmitting`/`error` on your behalf beyond that, so form field values are left exactly as the caller last set them. */
  submit: (...args: Args) => Promise<void>;
}

/**
 * Global Loading & Performance Optimization (Prompt 23) — a reusable form
 * submission handler for forms that manage their own submit state rather
 * than going through a TanStack `useMutation` (which already gives
 * `isPending` for free). Two things this adds beyond that:
 *   1. A `ref`-based guard that blocks a second concurrent `submit()` call
 *      even in the one-render-frame window before a disabled button
 *      actually stops accepting clicks — `mutation.isPending` alone can't
 *      close that gap since it only updates after a re-render.
 *   2. A single place to normalize thrown errors into a displayable
 *      message, without forcing every form to hand-roll its own
 *      try/catch/setError boilerplate.
 * Duplicate-submission side effects are already independently prevented at
 * the network layer too (see `api-client.ts`'s request de-duplication —
 * an identical in-flight request is aborted in favor of the newest one),
 * so this hook is a belt-and-suspenders UI-level guard, not the only line
 * of defense.
 *
 * `action` is read from a ref on every call, so passing a fresh inline
 * closure each render (the common case — it closes over the latest form
 * state) is safe; `submit` never uses a stale version of it.
 */
export function useSubmitHandler<Args extends unknown[] = []>(action: (...args: Args) => Promise<unknown>): UseSubmitHandlerResult<Args> {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const inFlightRef = React.useRef(false);
  const actionRef = React.useRef(action);
  actionRef.current = action;

  const submit = React.useCallback(async (...args: Args) => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setIsSubmitting(true);
    setError(null);
    try {
      await actionRef.current(...args);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      inFlightRef.current = false;
      setIsSubmitting(false);
    }
  }, []);

  return { isSubmitting, error, setError, submit };
}
