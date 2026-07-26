'use client';

import * as React from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

import { useAppDispatch } from '@/store/hooks';
import { navigationFinished, navigationStarted } from '@/store/ui-slice';

/** Force-clear the nav-pending flag if something goes wrong (an error boundary swallows the transition, a same-route "soft" navigation never changes pathname/searchParams, etc.) — the bar must never get stuck forever. */
const SAFETY_TIMEOUT_MS = 4000;

let historyPatched = false;

/**
 * Global Loading & Performance Optimization (Prompt 23) — the navigation
 * half of the top progress bar (the other half, API request activity, is
 * the pre-existing `pendingRequests` counter in `ui-slice.ts`). Covers
 * every navigation trigger the spec lists (sidebar, header menu,
 * breadcrumb, tabs, internal `<Link>`s, browser back/forward) by patching
 * `history.pushState`/`replaceState` ONCE at the module level — this is
 * how the Next.js App Router itself performs a client-side navigation
 * under the hood, so patching it catches every trigger without needing to
 * instrument each one individually — plus a `popstate` listener for
 * back/forward. `usePathname`/`useSearchParams` changing is treated as
 * "the new route has resolved," which clears the flag; a safety timeout
 * guarantees it can never get stuck showing forever.
 */
export function NavigationProgressProvider({ children }: { children: React.ReactNode }) {
  const dispatch = useAppDispatch();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isFirstRender = React.useRef(true);
  const safetyTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    if (historyPatched) return;
    historyPatched = true;

    const notifyStart = () => {
      // Deferred to a microtask — `pushState`/`replaceState` can be called
      // by the Next.js App Router from inside its own `useInsertionEffect`-
      // timed internals, where React forbids scheduling updates directly
      // (triggers "useInsertionEffect must not schedule updates"). Escaping
      // to a microtask runs the dispatch just after that phase ends, with
      // no visible delay.
      queueMicrotask(() => dispatch(navigationStarted()));
      if (safetyTimer.current) clearTimeout(safetyTimer.current);
      safetyTimer.current = setTimeout(() => dispatch(navigationFinished()), SAFETY_TIMEOUT_MS);
    };

    const originalPushState = window.history.pushState.bind(window.history);
    const originalReplaceState = window.history.replaceState.bind(window.history);

    window.history.pushState = ((...args: Parameters<typeof window.history.pushState>) => {
      notifyStart();
      return originalPushState(...args);
    }) as typeof window.history.pushState;

    window.history.replaceState = ((...args: Parameters<typeof window.history.replaceState>) => {
      notifyStart();
      return originalReplaceState(...args);
    }) as typeof window.history.replaceState;

    window.addEventListener('popstate', notifyStart);

    return () => {
      window.removeEventListener('popstate', notifyStart);
      // Deliberately NOT restoring the original history methods — this
      // provider is mounted once for the app's lifetime; unpatching would
      // only matter for hot-reload in dev, which the `historyPatched`
      // module guard already protects against re-patching.
    };
  }, [dispatch]);

  // The route (or its query string) actually changed — the navigation this
  // provider was tracking has resolved.
  React.useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (safetyTimer.current) clearTimeout(safetyTimer.current);
    dispatch(navigationFinished());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally re-runs only when the route itself changes, not on `dispatch` identity
  }, [pathname, searchParams]);

  return <>{children}</>;
}
