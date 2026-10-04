'use client';

import { motion, useReducedMotion } from 'framer-motion';

/** Gradient page banner — identical look to the Dashboard / Tenants banners. */
export const BANNER_BTN = 'inline-flex h-9 items-center gap-2 rounded-[9px] border border-white/30 bg-white/15 px-3.5 text-[13px] font-semibold text-white outline-none transition-colors hover:bg-white/25 focus-visible:ring-2 focus-visible:ring-white disabled:opacity-60 aria-pressed:bg-white/30';

export function PageBanner({ title, subtitle, children, above, chips }: { title: React.ReactNode; subtitle?: React.ReactNode; children?: React.ReactNode; above?: React.ReactNode; chips?: React.ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <motion.header
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="relative flex flex-wrap items-end justify-between gap-3 overflow-hidden rounded-2xl px-6 py-5 text-white"
      style={{ background: 'radial-gradient(600px 220px at 90% -40%, rgba(94,234,212,.45), transparent 60%), linear-gradient(115deg,#0f172a,#115e59 60%,#0e7490)' }}
    >
      <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: 'repeating-linear-gradient(135deg, rgba(255,255,255,.05) 0 1px, transparent 1px 14px)' }} />
      <div className="relative min-w-0">
        {above}
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle ? <p className="mt-0.5 text-[13px] text-teal-100" aria-live="polite">{subtitle}</p> : null}
        {chips ? <div className="mt-2 flex flex-wrap gap-1.5">{chips}</div> : null}
      </div>
      {children ? <div className="relative flex flex-wrap gap-2.5">{children}</div> : null}
    </motion.header>
  );
}
