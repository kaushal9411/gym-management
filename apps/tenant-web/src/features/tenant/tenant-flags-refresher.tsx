'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { MODULE_UNAVAILABLE_EVENT } from './module-unavailable-signal';

/** Periodic refresh cadence and the minimum gap between two focus/interval refreshes. */
const POLL_MS = 60_000;
const MIN_GAP_MS = 10_000;
/** 403 signals inside this window collapse into one refresh (a page firing 6 gated queries -> six 403s -> one refresh). */
const DEBOUNCE_MS = 300;
/** Even a 403 signal never refreshes more often than this (guards against a refresh storm if the flags did not change). */
const MIN_SIGNAL_GAP_MS = 3_000;

/**
 * Keeps `tenant.featureFlags` fresh without a manual reload. `RootLayout` re-resolves the tenant
 * (no-store) whenever it re-renders, so `router.refresh()` re-delivers the current flags to
 * `TenantProvider`. Triggers: window focus / tab becoming visible, every 60 s while the tab is
 * visible (both throttled to one refresh per 10 s), and when any API call returns 403
 * "This module is currently unavailable." (debounced, one refresh per burst).
 * Mounted once in `app/(portal)/layout.tsx`.
 */
export function TenantFlagsRefresher() {
  const router = useRouter();
  const routerRef = React.useRef(router);
  routerRef.current = router;

  React.useEffect(() => {
    let lastRefresh = Date.now();
    let debounce: ReturnType<typeof setTimeout> | undefined;

    const refresh = () => {
      lastRefresh = Date.now();
      routerRef.current.refresh();
    };
    const throttled = () => {
      if (document.hidden || Date.now() - lastRefresh < MIN_GAP_MS) return;
      refresh();
    };
    const onModuleUnavailable = () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        if (Date.now() - lastRefresh >= MIN_SIGNAL_GAP_MS) refresh();
      }, DEBOUNCE_MS);
    };
    const onVisibility = () => {
      if (!document.hidden) throttled();
    };

    const interval = setInterval(throttled, POLL_MS);
    window.addEventListener('focus', throttled);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener(MODULE_UNAVAILABLE_EVENT, onModuleUnavailable);
    return () => {
      clearInterval(interval);
      clearTimeout(debounce);
      window.removeEventListener('focus', throttled);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener(MODULE_UNAVAILABLE_EVENT, onModuleUnavailable);
    };
  }, []);

  return null;
}
