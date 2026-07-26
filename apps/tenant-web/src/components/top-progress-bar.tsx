'use client';

import { AnimatePresence, motion } from 'framer-motion';

import { useDelayedLoading } from '@/hooks/use-delayed-loading';
import { useAppSelector } from '@/store/hooks';

/**
 * Slim top-of-viewport progress bar — the app's single global loading
 * indicator, fed by two independent sources: in-flight API requests
 * (`pendingRequests`, driven by the axios interceptor) and App Router
 * navigations (`navigationPending`, driven by `NavigationProgressProvider`).
 * Either source showing activity is enough to show the bar.
 *
 * Extended in Prompt 23 (Global Loading & Performance Optimization) with
 * anti-flicker behavior via `useDelayedLoading`: a 100ms show-delay means
 * near-instant (cached/local) work never flashes a bar at all, and a
 * 300ms minimum display time means it never blinks in and immediately back
 * out. That trailing minimum-duration window doubles as the "complete to
 * 100%, then fade" animation — the bar widens toward 100% the instant the
 * underlying work finishes, then fades during the same window instead of
 * jumping away mid-progress.
 */
export function TopProgressBar() {
  const isLoading = useAppSelector((state) => state.ui.pendingRequests > 0 || state.ui.navigationPending);
  const visible = useDelayedLoading(isLoading, { showDelayMs: 100, minDurationMs: 300 });

  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          role="progressbar"
          aria-label="Loading"
          className="fixed inset-x-0 top-0 z-100 h-0.5 bg-primary/20"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="h-full bg-primary"
            initial={{ width: '0%' }}
            animate={{ width: isLoading ? '85%' : '100%' }}
            transition={{ duration: isLoading ? 8 : 0.25, ease: 'easeOut' }}
          />
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
