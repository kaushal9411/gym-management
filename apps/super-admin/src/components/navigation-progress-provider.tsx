'use client';

import * as React from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

import { useAppDispatch } from '@/store/hooks';
import { navigationFinished, navigationStarted } from '@/store/ui-slice';

/**
 * Force-clear the nav-pending flag if something goes wrong — see
 * tenant-web's identical provider for the full write-up. Deliberately
 * generous: a too-short safety timeout force-clears the flag (the
 * underlying RSC fetch isn't tracked by `pendingRequests` at all) while a
 * legitimately-slow-but-working navigation is still in progress, so the
 * loader falsely reports "done" and vanishes while the OLD page keeps
 * sitting there for several more seconds — confirmed live on tenant-web at
 * the old 4000ms value, on a route taking 10+ real seconds to compile in
 * `next dev`. This is purely a last-resort backstop for navigations that
 * never resolve at all; it should essentially never fire in practice.
 */
const SAFETY_TIMEOUT_MS = 20_000;

let historyPatched = false;

/**
 * `pushState`/`replaceState`'s third argument is the target URL — `null`/
 * `undefined` means "keep the current URL," exactly what `router.refresh()`
 * does. Treating a same-URL call as "nothing to show a loader for" — see
 * tenant-web's identical provider for the full write-up (confirmed live
 * there: a mutation's `router.refresh()` was popping the global loader
 * back up right after its own success toast, since the pathname never
 * actually changes and the clearing effect below never fires for it).
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
 * Ported from tenant-web's identical provider (see that file's comment for
 * the full write-up). Two independent trigger sources, both funnelling
 * into `notifyStart()`:
 *  1. A capture-phase `click` listener on `document` — fires the INSTANT
 *     the user clicks a same-tab internal link, before Next.js has done
 *     any async work at all. Primary signal — added because `pushState`
 *     alone isn't called until the App Router's RSC fetch resolves, and in
 *     `next dev` the first visit to a route can take several real seconds
 *     to compile server-side with zero client-side feedback until then
 *     (confirmed live on tenant-web via a user-provided screenshot).
 *  2. Patched `history.pushState`/`replaceState` (module-level guard,
 *     patched once) plus a `popstate` listener — also catches
 *     `router.push()` calls that don't originate from a click.
 * The listeners live in their own effect, deliberately NOT gated by
 * `historyPatched` — React Strict Mode's dev-only mount→cleanup→remount
 * dance would otherwise remove them in the cleanup pass and skip
 * re-adding them (the second pass hits the module guard's early return).
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
    // Deliberately no cleanup — see tenant-web's identical provider for why
    // (module guard, not a leak).
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
