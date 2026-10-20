'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { notifyProgrammaticNavigation } from '@/components/navigation-progress-provider';

const BACK = '__back__';

/**
 * In-page "unsaved changes" protection (no `window.confirm`). While `active`:
 *  - same-tab internal link clicks (sidebar, tabs, breadcrumbs, member links) are intercepted
 *    before Next's `<Link>` handles them and surfaced as `pendingTarget` for a dialog;
 *  - the browser Back button is intercepted via a same-URL history sentinel;
 *  - reload / tab close falls back to the browser's native `beforeunload` prompt (the only thing browsers allow).
 * Call `leave()` to proceed to the held destination, `stay()` to dismiss. `allowNavigation()` disarms
 * the guard (call right before a programmatic navigation after a successful send/save).
 */
export function useLeaveGuard(active: boolean) {
  const router = useRouter();
  const [pendingTarget, setPendingTarget] = React.useState<string | null>(null);
  const bypass = React.useRef(false);
  /** History entries we pushed (the sentinels) that sit above the real page. */
  const sentinels = React.useRef(0);

  React.useEffect(() => {
    if (!active) return;
    bypass.current = false;

    const onClick = (e: MouseEvent) => {
      if (bypass.current || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const anchor = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!anchor || (anchor.target && anchor.target !== '_self') || anchor.hasAttribute('download')) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      setPendingTarget(`${url.pathname}${url.search}${url.hash}`);
    };

    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (bypass.current) return;
      e.preventDefault();
      e.returnValue = '';
    };

    const pushSentinel = () => {
      try {
        // Keep Next's own history.state so its popstate handler stays happy (it reloads on foreign state).
        window.history.pushState(window.history.state, '', window.location.href);
        sentinels.current += 1;
      } catch {
        /* history unavailable: link + unload protection still apply */
      }
    };
    const onPopState = () => {
      if (bypass.current) return;
      sentinels.current = Math.max(0, sentinels.current - 1);
      setPendingTarget(BACK);
      pushSentinel();
    };

    if (sentinels.current === 0) pushSentinel();
    // Window capture runs before Next's Link and the navigation-progress listeners on document.
    window.addEventListener('click', onClick, true);
    window.addEventListener('beforeunload', onBeforeUnload);
    window.addEventListener('popstate', onPopState);
    return () => {
      window.removeEventListener('click', onClick, true);
      window.removeEventListener('beforeunload', onBeforeUnload);
      window.removeEventListener('popstate', onPopState);
    };
  }, [active]);

  const stay = React.useCallback(() => setPendingTarget(null), []);

  const leave = React.useCallback(() => {
    const target = pendingTarget;
    setPendingTarget(null);
    if (!target) return;
    bypass.current = true;
    if (target === BACK) {
      // Skip our sentinel entries plus the page we are leaving.
      window.history.go(-(sentinels.current + 1));
      return;
    }
    notifyProgrammaticNavigation(target);
    router.push(target);
  }, [pendingTarget, router]);

  const allowNavigation = React.useCallback(() => {
    bypass.current = true;
  }, []);

  return { pendingTarget, stay, leave, allowNavigation };
}
