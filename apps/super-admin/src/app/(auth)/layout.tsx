import { LoginHero } from '@/features/auth/components/login-hero';

/**
 * Shell for the `(auth)` route group — in this app that's exactly `/login`
 * (no forgot-password/2FA routes exist here), so this can commit fully to
 * the redesigned neon-dark aesthetic without affecting any other page.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden">
      <LoginHero />
      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}
