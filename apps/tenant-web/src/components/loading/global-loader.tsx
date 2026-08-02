'use client';

import * as React from 'react';
import { AnimatePresence, motion } from 'framer-motion';

import { useDelayedLoading } from '@/hooks/use-delayed-loading';
import { useAppSelector } from '@/store/hooks';
import { GymLoader } from './gym-loader';

/**
 * No request in this app reports real byte-level progress — this is a
 * cosmetic "asymptotic" progress climb (fast start, slows as it nears the
 * cap), the same trick NProgress-style bars use for indeterminate loads:
 * quickly reaches ~60%, crawls toward a 92% cap while genuinely still
 * pending (never lies and claims 100% before the work is actually done),
 * then snaps to 100% the instant `active` goes false.
 */
function useAsymptoticProgress(active: boolean): number {
  const [progress, setProgress] = React.useState(0);

  React.useEffect(() => {
    if (!active) {
      setProgress((p) => (p > 0 ? 100 : 0));
      return undefined;
    }
    setProgress(8);
    const id = setInterval(() => {
      setProgress((p) => {
        if (p >= 92) return p;
        const remaining = 92 - p;
        return p + remaining * 0.06 + 0.4;
      });
    }, 120);
    return () => clearInterval(id);
  }, [active]);

  return progress;
}

/**
 * The single, app-wide loading indicator (Prompt 33). Mounted exactly once,
 * at the root of `AppProviders` — every page gets it automatically, nothing
 * to import per-page. This file owns WHEN it shows; `gym-loader.tsx` (pure
 * presentational, `progress`/`label` props only) owns what it looks like —
 * edit that file to change the visual.
 *
 * Fed by two Redux signals in `ui-slice.ts`: `pendingRequests` (every
 * in-flight call through the shared `apiClient`) and `navigationPending`
 * (`navigation-progress-provider.tsx`). Either one active shows the loader.
 *
 * Deliberately `pointer-events-none` on the backdrop: `pendingRequests`
 * also ticks up for background work the user never triggered (e.g.
 * notification polling), and a *blocking* overlay driven by that same
 * broad signal was confirmed live (an earlier version of this component,
 * under throttled network) to trap every click on the page behind an
 * invisible, user-uninitiated request. Non-blocking removes that failure
 * mode entirely.
 */
export function GlobalLoader() {
  const isLoading = useAppSelector((state) => state.ui.pendingRequests > 0 || state.ui.navigationPending);
  // offDelayMs wider than the hook's own default: confirmed live that the
  // gap between "navigationPending clears (route/pathname committed)" and
  // "the new page's own first data fetch actually registers as pending"
  // can run 500-700ms in dev mode (the route's JS chunk + component mount
  // + effect-fire cycle, not just a network round trip) — the default
  // 200ms wasn't enough to bridge it, so the loader was disappearing while
  // the new page was still genuinely empty/loading underneath.
  const visible = useDelayedLoading(isLoading, { showDelayMs: 150, minDurationMs: 300, offDelayMs: 900 });
  const progress = useAsymptoticProgress(isLoading);

  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center"
          style={{ background: 'rgba(15, 17, 21, 0.82)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          role="status"
          aria-live="polite"
        >
          <GymLoader progress={progress} />
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
