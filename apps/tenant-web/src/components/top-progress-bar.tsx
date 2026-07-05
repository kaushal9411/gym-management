'use client';

import { AnimatePresence, motion } from 'framer-motion';

import { useAppSelector } from '@/store/hooks';

/** Slim top-of-viewport progress bar, visible while any API request is in flight. */
export function TopProgressBar() {
  const isLoading = useAppSelector((state) => state.ui.pendingRequests > 0);

  return (
    <AnimatePresence>
      {isLoading ? (
        <motion.div
          role="progressbar"
          aria-label="Loading"
          className="fixed inset-x-0 top-0 z-[100] h-0.5 bg-primary/20"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="h-full bg-primary"
            initial={{ width: '0%' }}
            animate={{ width: '85%' }}
            transition={{ duration: 8, ease: 'easeOut' }}
          />
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
