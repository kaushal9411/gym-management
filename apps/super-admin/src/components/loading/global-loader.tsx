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
 * The single, app-wide loading indicator (Prompt 33, ported from
 * tenant-web's identical component). Mounted exactly once, at the root of
 * `AppProviders` — every page gets it automatically, nothing to import
 * per-page. This file owns WHEN it shows; `gym-loader.tsx` (pure
 * presentational, `progress`/`label` props only) owns what it looks like.
 *
 * Fed by two Redux signals in `ui-slice.ts`: `pendingRequests` (every
 * in-flight call through the shared `apiClient`) and `navigationPending`
 * (`navigation-progress-provider.tsx`). Either one active shows the loader.
 *
 * Deliberately `pointer-events-none` on the backdrop — a *blocking*
 * overlay driven by this same broad signal was confirmed live on
 * tenant-web (under throttled network) to trap every click on the page
 * behind an invisible, user-uninitiated request.
 */
export function GlobalLoader() {
  const isLoading = useAppSelector((state) => state.ui.pendingRequests > 0 || state.ui.navigationPending);
  // offDelayMs wider than the hook's own default — see tenant-web's
  // identical component for the full write-up: confirmed live that the
  // gap between "navigationPending clears" and "the new page's own first
  // data fetch actually registers as pending" can run 500-700ms in dev
  // mode, wider than the hook's default 200ms debounce.
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
