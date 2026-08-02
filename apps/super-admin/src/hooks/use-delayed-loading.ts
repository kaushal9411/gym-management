'use client';

import * as React from 'react';

interface UseDelayedLoadingOptions {
  /** Don't show the loader at all until it's been true for this long — hides very fast operations entirely. Default 150ms. */
  showDelayMs?: number;
  /** Once shown, keep showing for at least this long, even if `isLoading` flips false sooner — avoids an abrupt flash-then-gone. Default 300ms. */
  minDurationMs?: number;
  /**
   * Once `isLoading` flips false, wait at least this long before actually
   * hiding — if it flips back to true within this window, the hide is
   * cancelled and the loader just stays visible. Default 200ms.
   *
   * Exists because "loading" is often really a CHAIN of separate signals,
   * not one continuous one — e.g. a route's own navigation-pending flag
   * clearing right as the new page's first data fetch is about to register
   * as pending. Without this debounce, `isLoading` can read `false` for a
   * brief real gap between the two, and the loader closes even though the
   * page genuinely isn't ready yet (confirmed live: user-reported "loader
   * hits 100% and disappears, but the page hasn't changed yet").
   */
  offDelayMs?: number;
}

/**
 * Global Loading & Performance Optimization (Prompt 23) — the shared
 * anti-flicker primitive behind every loader in this app. Three
 * independent timers: a **show delay** (swallow loading states shorter
 * than this — most cached/fast requests never visibly flash a spinner), a
 * **minimum display time** once the loader does appear, and an **off
 * debounce** (a brief `isLoading` flip to false doesn't count until it's
 * stayed false for a beat — see `offDelayMs` above).
 */
export function useDelayedLoading(isLoading: boolean, options: UseDelayedLoadingOptions = {}): boolean {
  const { showDelayMs = 150, minDurationMs = 300, offDelayMs = 200 } = options;
  const [visible, setVisible] = React.useState(false);
  const shownAtRef = React.useRef<number | null>(null);
  const hideTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }

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
    // Whichever is longer: the minimum-display floor, or the off-debounce
    // window — either way, a quick flip back to `true` (dependency change
    // re-runs this effect, clearing this timer via the cleanup above)
    // cancels the hide entirely instead of letting it complete.
    const delay = Math.max(remaining, offDelayMs);
    hideTimerRef.current = setTimeout(() => {
      shownAtRef.current = null;
      hideTimerRef.current = null;
      setVisible(false);
    }, delay);
    return () => {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
    };
  }, [isLoading, showDelayMs, minDurationMs, offDelayMs]);

  return visible;
}
