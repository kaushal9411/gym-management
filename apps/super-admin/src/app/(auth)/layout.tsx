import { ThemeToggle } from '@/components/theme-toggle';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-32 left-1/2 h-96 w-[42rem] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-40 -right-24 h-80 w-96 rounded-full bg-primary/5 blur-3xl" />
      </div>

      <header className="flex items-center justify-end p-4">
        <ThemeToggle />
      </header>

      <main className="flex flex-1 items-center justify-center px-4 pb-10">
        <div className="w-full max-w-sm">{children}</div>
      </main>

      <footer className="pb-6 text-center text-xs text-muted-foreground">
        FitCloud Admin · Internal use only
      </footer>
    </div>
  );
}
