import { ThemeToggle } from '@/components/theme-toggle';

/**
 * Own top-level segment (not under `(auth)`) because the registration
 * wizard needs more horizontal room than every other auth screen — plan
 * cards and multi-field rows don't fit the shared AuthLayout's `max-w-md`.
 * Otherwise mirrors that shell: decorative background, theme toggle, footer.
 */
export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-32 left-1/2 h-96 w-[42rem] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-40 -right-24 h-80 w-96 rounded-full bg-primary/5 blur-3xl" />
      </div>

      <header className="flex items-center justify-end p-4">
        <ThemeToggle />
      </header>

      <main className="flex flex-1 items-start justify-center px-4 pb-10 pt-2 sm:items-start sm:pt-8">
        <div className="w-full max-w-2xl">{children}</div>
      </main>

      <footer className="pb-6 text-center text-xs text-muted-foreground">
        Powered by <span className="font-semibold">FitCloud</span> · ©{' '}
        {new Date().getFullYear()} FitCloud, Inc.
      </footer>
    </div>
  );
}
