'use client';

import { ThemeToggle } from '@/components/theme-toggle';
import { LoginHero } from '@/features/auth/components/login-hero';
import { useTenant } from '@/features/tenant/tenant-provider';

/**
 * Own top-level segment (not under `(auth)`) because the registration
 * wizard needs more horizontal room than every other auth screen — plan
 * cards and multi-field rows don't fit the shared AuthLayout's `max-w-md`.
 * Reuses the same neon-dark backdrop as `/login` (`LoginHero` — generic,
 * not tenant-scoped, safe to share across both) for a consistent
 * authentication-flow identity end to end. `useTenant()` only for the
 * platform name in the footer — the rest of this page is intentionally
 * not tenant-scoped.
 */
export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  const tenant = useTenant();

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden">
      <LoginHero />

      <div className="absolute right-3 top-3 z-20 sm:right-5 sm:top-4">
        <ThemeToggle />
      </div>

      <main className="flex flex-1 items-start justify-center px-4 pb-10 pt-8 sm:pt-12">
        <div className="w-full max-w-2xl">{children}</div>
      </main>

      <footer className="pb-6 text-center text-xs text-foreground/40">
        Powered by <span className="font-semibold text-foreground/60">{tenant.platformName}</span> · ©{' '}
        {new Date().getFullYear()} {tenant.platformName}, Inc.
      </footer>
    </div>
  );
}
