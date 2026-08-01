import { LoginHero } from '@/features/auth/components/login-hero';

/**
 * Own top-level segment (not under `(auth)`) because the registration
 * wizard needs more horizontal room than every other auth screen — plan
 * cards and multi-field rows don't fit the shared AuthLayout's `max-w-md`.
 * Reuses the same neon-dark backdrop as `/login` (`LoginHero` — generic,
 * not tenant-scoped, safe to share across both) for a consistent
 * authentication-flow identity end to end.
 */
export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden">
      <LoginHero />

      <main className="flex flex-1 items-start justify-center px-4 pb-10 pt-8 sm:pt-12">
        <div className="w-full max-w-2xl">{children}</div>
      </main>

      <footer className="pb-6 text-center text-xs text-white/25">
        Powered by <span className="font-semibold text-white/40">FitCloud</span> · ©{' '}
        {new Date().getFullYear()} FitCloud, Inc.
      </footer>
    </div>
  );
}
