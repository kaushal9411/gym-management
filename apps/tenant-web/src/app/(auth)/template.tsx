'use client';

import { motion } from 'framer-motion';

/**
 * Re-mounts on every route change inside the auth group, giving each page
 * a consistent entrance transition (fade + rise). Respects reduced motion.
 */
export default function AuthTemplate({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
}
