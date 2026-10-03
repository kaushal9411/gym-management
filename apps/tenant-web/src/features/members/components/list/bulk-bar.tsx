'use client';

import { AnimatePresence, motion } from 'framer-motion';

import { Button } from '@/components/ui/button';

interface BulkBarProps {
  count: number;
  canManage: boolean;
  canDelete: boolean;
  onActivate: () => void;
  onDeactivate: () => void;
  onDelete: () => void;
  onClear: () => void;
}

/** Floats at the bottom of the viewport while rows are selected, so it's reachable however far the list is scrolled. */
export function BulkBar({ count, canManage, canDelete, onActivate, onDeactivate, onDelete, onClear }: BulkBarProps) {
  return (
    <AnimatePresence>
      {count > 0 && (canManage || canDelete) ? (
        <motion.div
          role="region"
          aria-label="Bulk actions"
          initial={{ y: 120, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 120, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 28 }}
          className="fixed bottom-[calc(1.25rem+env(safe-area-inset-bottom,0px))] left-1/2 z-30 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 flex-wrap items-center justify-center gap-2 rounded-2xl bg-foreground px-4 py-2.5 text-background shadow-2xl"
        >
          <b className="px-1 text-sm tabular-nums">{count} selected</b>
          {canManage ? (
            <>
              <Button size="sm" variant="secondary" className="bg-white/15 text-inherit hover:bg-white/25" onClick={onActivate}>
                Bulk activate
              </Button>
              <Button size="sm" variant="secondary" className="bg-white/15 text-inherit hover:bg-white/25" onClick={onDeactivate}>
                Bulk deactivate
              </Button>
            </>
          ) : null}
          {canDelete ? (
            <Button size="sm" variant="destructive" onClick={onDelete}>
              Bulk delete
            </Button>
          ) : null}
          <Button size="sm" variant="ghost" className="text-inherit hover:bg-white/15 hover:text-inherit" onClick={onClear}>
            Clear
          </Button>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
