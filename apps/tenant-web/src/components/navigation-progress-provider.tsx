'use client';

import * as React from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

import { useAppDispatch } from '@/store/hooks';
import { navigationFinished, navigationStarted } from '@/store/ui-slice';

/**
 * Force-clear the nav-pending flag if something goes wrong (an error
 * boundary swallows the transition, a same-route "soft" navigation never
 * changes pathname/searchParams, etc.) — the loader must never get stuck
 * on forever. Deliberately generous: this fired at its old value (4000ms)
 * on a real, legitimately-slow-but-working navigation — user-reported and
 * confirmed via a DevTools screenshot showing the route's `_rsc` fetch
 * still genuinely in flight (not hung) 10+ seconds after the click, on a
 * heavier page compiling for the first time in `next dev`. A too-short
 * safety timeout is worse than a too-long one: it force-clears the flag
 * (and the underlying RSC fetch isn't tracked by `pendingRequests` at all,
 * so nothing else keeps the loader up) while the navigation is still
 * genuinely in progress, so the loader falsely reports "done" and vanishes
 * while the OLD page keeps sitting there for several more seconds with no
 * indication anything is still happening — the exact symptom this
 * component exists to prevent. This is purely a last-resort backstop for
 * navigations that never resolve at all; it should essentially never fire
 * in practice.
 */
const SAFETY_TIMEOUT_MS = 20_000;

let historyPatched = false;

/**
 * `pushState`/`replaceState`'s third argument is the target URL — `null`/
 * `undefined` means "keep the current URL." A same-URL call is exactly
 * what `router.refresh()` does (re-fetch the current route's RSC payload
 * with no navigation): confirmed live it was the actual cause of the
 * global loader reappearing right after an upload's own success toast —
 * every branding upload calls `router.refresh()` afterward to update the
 * portal chrome, which (like any `pushState`/`replaceState` call) was
 * unconditionally treated as "a navigation started," and since the
 * pathname never actually changes, the `[pathname, searchParams]`
 * clearing effect below never fires for it — leaving the loader up until
 * the `SAFETY_TIMEOUT_MS` backstop, which is a much longer wait now than
 * it used to be. Treating a same-URL call as "nothing to show a loader
 * for" fixes it at the source instead of trading against that timeout.
 */
function isSameUrl(url: string | URL | null | undefined): boolean {
  if (url == null) return true;
  try {
    return new URL(url, window.location.href).href === window.location.href;
  } catch {
    return false;
  }
}

/** Closest ancestor `<a>` this click would actually navigate via, or `null` if it's not a plain same-tab internal-link click (modifier key, new tab, download, external, hash-only, etc.). */
function internalNavHrefFrom(event: MouseEvent): string | null {
  if (event.defaultPrevented || event.button !== 0) return null;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return null;
  const anchor = (event.target as HTMLElement | null)?.closest?.<HTMLAnchorElement>('a[href]');
  if (!anchor) return null;
  if (anchor.hasAttribute('download') || anchor.target === '_blank') return null;
  const href = anchor.getAttribute('href');
  if (!href || href.startsWith('#') || /^[a-z][a-z0-9+.-]*:/i.test(href)) return null; // hash-only or has a scheme (mailto:, tel:, http(s):, etc.)
  return href;
}

/**
 * Global Loading & Performance Optimization (Prompt 23) — the navigation
 * half of the top progress bar (the other half, API request activity, is
 * the pre-existing `pendingRequests` counter in `ui-slice.ts`). Covers
 * every navigation trigger the spec lists (sidebar, header menu,
 * breadcrumb, tabs, internal `<Link>`s, browser back/forward).
 *
 * Two independent trigger sources, both funnelling into `notifyStart()`:
 *  1. A capture-phase `click` listener on `document` (Prompt 33+) — fires
 *     the INSTANT the user clicks a same-tab internal link, before Next.js
 *     has done any async work at all. This is the primary signal.
 *  2. Patched `history.pushState`/`replaceState` (module-level
 *     `historyPatched` guard — patched exactly once for the page's
 *     lifetime, since re-patching on every remount would stack wrappers)
 *     plus a `popstate` listener — this is how the App Router itself
 *     performs a client-side navigation, so it also catches `router.push()`
 *     calls that don't originate from a click (redirects, programmatic
 *     nav). The listeners live in their OWN effect, deliberately NOT gated
 *     by `historyPatched` — they need the normal React mount/unmount
 *     lifecycle (added fresh every real mount) rather than a "set up once,
 *     never again" guard, otherwise React Strict Mode's dev-only
 *     mount→cleanup→remount dance on initial load would remove them in the
 *     cleanup pass and then skip re-adding them (the second pass hits the
 *     module guard's early return) — confirmed by reasoning through
 *     exactly that sequence while building this; both effects call through
 *     a ref (`notifyStartRef`) rather than closing over `notifyStart`
 *     directly, so patched `pushState`/`replaceState` (created once) still
 *     always invokes the current, correctly-scoped version.
 *
 * The click listener exists because of a real gap found live: the App
 * Router fetches a route's RSC payload as part of committing a navigation,
 * and `pushState` isn't called until that fetch resolves. In `next dev`,
 * the FIRST visit to a route triggers on-demand server-side compilation,
 * which can take several real seconds — during which nothing client-side
 * has fired yet, so relying on `pushState` alone means no loader shows at
 * all for that whole window (confirmed live via a user-provided
 * screenshot: DevTools Network tab showed the route's `_rsc` fetch sitting
 * at "Pending" while the page showed literally nothing — no loader, no
 * route change — because from this provider's point of view no navigation
 * had "started" yet).
 *
 * `usePathname`/`useSearchParams` changing is treated as "the new route has
 * resolved," which clears the flag; a safety timeout guarantees it can
 * never get stuck showing forever even if the route change never actually
 * lands (e.g. a broken link, a swallowed error).
 *
 * The dispatch that flips the flag on is deferred via `queueMicrotask` —
 * dispatching synchronously reproduces a real "useInsertionEffect must not
 * schedule updates" React error, since `pushState`/`replaceState` can be
 * called by the App Router from inside its own `useInsertionEffect`-timed
 * internals. That defer creates an ordering hazard for an already-resolved
 * navigation (the route can finish — dispatching `navigationFinished` —
 * before the deferred `navigationStarted` microtask even runs, which would
 * otherwise leave the flag stuck permanently "on"). Fixed with two
 * synchronous refs that make the deferred dispatch self-aware instead of
 * blindly firing: `pendingGenRef` (only the latest `notifyStart` call's
 * generation may still dispatch "started") and `pathKeyRef` (kept fresh
 * every render, so the deferred microtask can tell whether the route it was
 * triggered for has *already* resolved by the time it runs).
 */
export function NavigationProgressProvider({ children }: { children: React.ReactNode }) {
  const dispatch = useAppDispatch();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isFirstRender = React.useRef(true);
  const safetyTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  /** 0 = not pending. Any other value = the generation of the in-flight navigation. */
  const pendingGenRef = React.useRef(0);
  const nextGenRef = React.useRef(1);
  const pathKeyRef = React.useRef(`${pathname}?${searchParams.toString()}`);
  pathKeyRef.current = `${pathname}?${searchParams.toString()}`;

  const notifyStart = React.useCallback((targetUrl?: string | URL | null) => {
    if (isSameUrl(targetUrl)) return; // same-route soft navigation (e.g. router.refresh()) — see isSameUrl's doc comment

    const gen = nextGenRef.current++;
    const pathKeyAtStart = pathKeyRef.current;
    pendingGenRef.current = gen;

    queueMicrotask(() => {
      if (pendingGenRef.current !== gen) return; // superseded by a newer navigation already
      if (pathKeyRef.current !== pathKeyAtStart) {
        // The route already resolved before this deferred dispatch got to
        // run — the "finished" effect below already ran and found nothing
        // pending, so it's on us not to flip the flag back on for a
        // navigation that's already done.
        pendingGenRef.current = 0;
        return;
      }
      dispatch(navigationStarted());
    });

    if (safetyTimer.current) clearTimeout(safetyTimer.current);
    safetyTimer.current = setTimeout(() => {
      if (pendingGenRef.current === gen) {
        pendingGenRef.current = 0;
        dispatch(navigationFinished());
      }
    }, SAFETY_TIMEOUT_MS);
  }, [dispatch]);

  const notifyStartRef = React.useRef(notifyStart);
  notifyStartRef.current = notifyStart;

  // Patch history exactly once for the page's lifetime — see doc comment above for why this is split from the listener effect below.
  React.useEffect(() => {
    if (historyPatched) return;
    historyPatched = true;

    const originalPushState = window.history.pushState.bind(window.history);
    const originalReplaceState = window.history.replaceState.bind(window.history);

    window.history.pushState = ((...args: Parameters<typeof window.history.pushState>) => {
      notifyStartRef.current(args[2]);
      return originalPushState(...args);
    }) as typeof window.history.pushState;

    window.history.replaceState = ((...args: Parameters<typeof window.history.replaceState>) => {
      notifyStartRef.current(args[2]);
      return originalReplaceState(...args);
    }) as typeof window.history.replaceState;
    // Deliberately no cleanup — this provider is mounted once for the
    // app's lifetime; unpatching would only matter for hot-reload in dev,
    // which the `historyPatched` module guard already protects against
    // re-patching.
  }, []);

  // popstate + click listeners — normal mount/unmount lifecycle (NOT gated by `historyPatched`, see doc comment above).
  React.useEffect(() => {
    const onPopState = () => notifyStartRef.current();
    const onClickCapture = (event: MouseEvent) => {
      const href = internalNavHrefFrom(event);
      if (!href) return;
      const targetPath = href.split('#')[0];
      if (targetPath === `${window.location.pathname}${window.location.search}` || targetPath === window.location.pathname) return;
      notifyStartRef.current();
    };

    window.addEventListener('popstate', onPopState);
    document.addEventListener('click', onClickCapture, { capture: true });

    return () => {
      window.removeEventListener('popstate', onPopState);
      document.removeEventListener('click', onClickCapture, { capture: true });
    };
  }, []);

  // The route (or its query string) actually changed — the navigation this
  // provider was tracking has resolved.
  React.useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (pendingGenRef.current === 0) return; // nothing pending yet — the corresponding start hasn't landed; it'll no-op itself via pathKeyRef above
    pendingGenRef.current = 0;
    if (safetyTimer.current) clearTimeout(safetyTimer.current);
    dispatch(navigationFinished());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally re-runs only when the route itself changes, not on `dispatch` identity
  }, [pathname, searchParams]);

  return <>{children}</>;
}
