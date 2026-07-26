'use client';

import * as React from 'react';

interface UseDelayedLoadingOptions {
  /** Don't show the loader at all until it's been true for this long — hides very fast operations entirely. Default 150ms. */
  showDelayMs?: number;
  /** Once shown, keep showing for at least this long, even if `isLoading` flips false sooner — avoids an abrupt flash-then-gone. Default 300ms. */
  minDurationMs?: number;
}

/**
 * Global Loading & Performance Optimization (Prompt 23) — the shared
 * anti-flicker primitive behind every loader in this app (full-screen,
 * page, section, and the top progress bar). Two independent timers:
 * a **show delay** (swallow loading states shorter than this — most
 * cached/fast requests never visibly flash a spinner) and a **minimum
 * display time** once the loader does appear (so it doesn't blink in and
 * back out within one animation frame for a request that finishes just
 * after the delay threshold).
 */
export function useDelayedLoading(isLoading: boolean, options: UseDelayedLoadingOptions = {}): boolean {
  const { showDelayMs = 150, minDurationMs = 300 } = options;
  const [visible, setVisible] = React.useState(false);
  const shownAtRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    if (isLoading) {
      const showTimer = setTimeout(() => {
        shownAtRef.current = Date.now();
        setVisible(true);
      }, showDelayMs);
      return () => clearTimeout(showTimer);
    }

    if (shownAtRef.current === null) {
      setVisible(false);
      return undefined;
    }

    const elapsed = Date.now() - shownAtRef.current;
    const remaining = Math.max(0, minDurationMs - elapsed);
    const hideTimer = setTimeout(() => {
      shownAtRef.current = null;
      setVisible(false);
    }, remaining);
    return () => clearTimeout(hideTimer);
  }, [isLoading, showDelayMs, minDurationMs]);

  return visible;
}
