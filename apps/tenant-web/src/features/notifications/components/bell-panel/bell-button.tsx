'use client';

import * as React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Bell, BellRing } from 'lucide-react';

import { useMotionSafe } from '@/features/reports/lib/motion';
import { cn } from '@/lib/utils';

/**
 * Header bell trigger. `unreadCount` is the existing Redux mirror; when it goes UP (socket `notification:new`
 * or a refetch with more unread) the icon rings once. The badge pings only while unread > 0. No extra network.
 */
export function BellButton({ unreadCount, open, onClick }: { unreadCount: number; open: boolean; onClick: () => void }) {
  const m = useMotionSafe();
  const prev = React.useRef(unreadCount);
  const [ringKey, setRingKey] = React.useState(0);

  React.useEffect(() => {
    if (unreadCount > prev.current) setRingKey((k) => k + 1);
    prev.current = unreadCount;
  }, [unreadCount]);

  const label = unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications';
  return (
    <button
      type="button"
      aria-label={label}
      aria-haspopup="dialog"
      aria-expanded={open}
      onClick={onClick}
      className={cn(
        'relative inline-flex size-9 items-center justify-center rounded-full text-muted-foreground ring-1 ring-transparent transition-all duration-150',
        'hover:bg-accent hover:text-foreground hover:ring-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-95',
        open && 'bg-accent text-foreground ring-border',
      )}
      style={unreadCount > 0 ? { color: 'var(--chart-7)' } : undefined}
    >
      <motion.span
        key={ringKey}
        className="inline-flex origin-top"
        animate={ringKey > 0 && !m.reduce ? { rotate: [0, 18, -16, 12, -8, 4, 0] } : undefined}
        transition={{ duration: 0.8, ease: 'easeInOut' }}
      >
        {unreadCount > 0 ? <BellRing className="size-[18px]" aria-hidden /> : <Bell className="size-[18px]" aria-hidden />}
      </motion.span>
      <AnimatePresence>
        {unreadCount > 0 && (
          <motion.span
            key="badge"
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.4, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 420, damping: 24 }}
            className="pointer-events-none absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center"
            aria-hidden
          >
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-destructive/50 motion-reduce:hidden" />
            <span className="relative flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-none text-white shadow-sm ring-2 ring-background">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}
