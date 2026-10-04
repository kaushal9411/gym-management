'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';

import { cn } from '@/lib/utils';
import { useMotionSafe } from '@/features/reports/lib/motion';

/**
 * Page enter transition, keyed on pathname (opacity/translate only; no-op under
 * reduced motion). Already applied by the shell around every page - pages
 * need not use it. It is enter-only on purpose: with the App Router the old
 * route's children are gone before an exit animation could run.
 */
export function PortalPage({ children, className }: { children: React.ReactNode; className?: string }) {
  const pathname = usePathname();
  const m = useMotionSafe();
  return (
    <motion.div key={pathname} variants={m.pageTransition} initial={m.initial} animate="show" className={cn('min-w-0', className)}>
      {children}
    </motion.div>
  );
}
