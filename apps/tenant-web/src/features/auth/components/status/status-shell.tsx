'use client';

import * as React from 'react';
import { motion, useReducedMotion } from 'framer-motion';

import { ThemeToggle } from '@/components/theme-toggle';
import { TenantLogo } from '@/features/tenant/components/tenant-logo';
import { useTenant } from '@/features/tenant/tenant-provider';
import { cn } from '@/lib/utils';

interface StatusShellProps {
  children: React.ReactNode;
  /** Tailwind max-width class for the glass card. */
  maxWidth?: string;
  /** Extra classes for the card (padding is up to the content). */
  cardClassName?: string;
}

/**
 * Full-screen tenant-branded shell for standalone status pages (maintenance,
 * access denied, suspended, expired …): brand gradient with soft moving blobs
 * + dotted grid, tenant logo/name header with theme toggle, a centred glass
 * card, and the "Powered by FitCloud" footer.
 */
export function StatusShell({ children, maxWidth = 'max-w-xl', cardClassName }: StatusShellProps) {
  const tenant = useTenant();
  const reduce = useReducedMotion() ?? false;

  return (
    <div className="gradient-brand relative isolate flex min-h-dvh flex-col overflow-hidden text-primary-foreground">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <motion.div className="absolute -left-32 -top-32 size-[28rem] rounded-full bg-white/15 blur-3xl" animate={reduce ? undefined : { x: [0, 40, 0], y: [0, 30, 0] }} transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }} />
        <motion.div className="absolute -bottom-40 -right-24 size-[32rem] rounded-full bg-black/20 blur-3xl" animate={reduce ? undefined : { x: [0, -50, 0], y: [0, -30, 0] }} transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }} />
        <svg className="absolute inset-0 size-full opacity-[0.08]">
          <pattern id="status-grid" width="32" height="32" patternUnits="userSpaceOnUse">
            <circle cx="1.5" cy="1.5" r="1.5" fill="currentColor" />
          </pattern>
          <rect width="100%" height="100%" fill="url(#status-grid)" />
        </svg>
      </div>

      <header className="flex items-center justify-between gap-3 p-4 sm:p-6">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-white/15 p-1.5 ring-1 ring-white/25 backdrop-blur-sm">
            <TenantLogo size="lg" className="size-full rounded-xl" />
          </div>
          <span className="truncate text-base font-semibold tracking-tight sm:text-lg">{tenant.name}</span>
        </div>
        <div className="rounded-lg bg-white/15 ring-1 ring-white/25 backdrop-blur-sm [&_button]:text-primary-foreground">
          <ThemeToggle />
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 pb-8">
        <motion.section
          initial={reduce ? false : { opacity: 0, y: 24, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className={cn('w-full overflow-hidden rounded-3xl border border-white/20 bg-background/90 text-foreground shadow-2xl backdrop-blur-xl', maxWidth, cardClassName)}
          aria-live="polite"
        >
          {children}
        </motion.section>
      </main>

      <footer className="pb-5 text-center text-xs text-primary-foreground/80">
        Powered by <span className="font-semibold">FitCloud</span> · © {new Date().getFullYear()} FitCloud, Inc.
      </footer>
    </div>
  );
}
