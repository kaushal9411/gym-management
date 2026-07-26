'use client';

import { CalendarCheck, LineChart, Users, Wallet } from 'lucide-react';

import { ThemeToggle } from '@/components/theme-toggle';
import { TenantLogo } from '@/features/tenant/components/tenant-logo';
import { useTenant } from '@/features/tenant/tenant-provider';

const HIGHLIGHTS = [
  { icon: Users, label: 'Members, staff & branches in one place' },
  { icon: CalendarCheck, label: 'Attendance, workouts & diet plans' },
  { icon: Wallet, label: 'Payments, invoices & expense tracking' },
  { icon: LineChart, label: 'Reports & analytics that stay current' },
];

/**
 * Shared shell for every authentication + status page: a branded split-screen
 * on large viewports (gradient hero left, form right) collapsing to a single
 * centered column below `lg`. Every `(auth)` route (login, register status
 * pages, forgot/reset password, verify-email/otp, invitation, status
 * screens…) renders through this one file. Reads tenant branding from the
 * existing `TenantProvider` context (already resolved server-side by the
 * root layout) rather than re-fetching `resolveTenant` a second time.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const tenant = useTenant();

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      {/* Hero panel — brand gradient, hidden below lg */}
      <div className="gradient-brand relative hidden w-full shrink-0 flex-col justify-between overflow-hidden p-10 text-primary-foreground lg:flex lg:w-[42%] xl:w-[38%]">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute -left-24 -top-24 size-72 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -bottom-32 -right-16 size-96 rounded-full bg-black/10 blur-3xl" />
          <svg className="absolute inset-0 size-full opacity-[0.07]" aria-hidden>
            <pattern id="auth-grid" width="32" height="32" patternUnits="userSpaceOnUse">
              <circle cx="1.5" cy="1.5" r="1.5" fill="currentColor" />
            </pattern>
            <rect width="100%" height="100%" fill="url(#auth-grid)" />
          </svg>
        </div>

        <div className="relative flex items-center gap-3">
          <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-white/15 p-1.5 ring-1 ring-white/25 backdrop-blur-sm">
            <TenantLogo size="lg" className="size-full rounded-xl" />
          </div>
          <span className="text-lg font-semibold tracking-tight">{tenant.name}</span>
        </div>

        <div className="relative space-y-6">
          <h2 className="text-3xl font-semibold leading-tight tracking-tight xl:text-4xl">
            Run your entire gym from one clean dashboard.
          </h2>
          <p className="max-w-sm text-sm text-primary-foreground/80">
            {tenant.branding.welcomeMessage ??
              'Everything your team needs to manage members, staff, billing and more — in one modern portal.'}
          </p>
        </div>

        <div className="glass-panel relative rounded-2xl p-5">
          <ul className="space-y-3">
            {HIGHLIGHTS.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-3 text-sm text-primary-foreground">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white/15">
                  <Icon className="size-4" aria-hidden />
                </span>
                {label}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Form column */}
      <div className="relative flex flex-1 flex-col overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 lg:hidden">
          <div className="absolute -top-32 left-1/2 h-96 w-2xl -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />
          <div className="absolute -bottom-40 -right-24 h-80 w-96 rounded-full bg-primary/5 blur-3xl" />
        </div>

        <header className="flex items-center justify-end p-4">
          <ThemeToggle />
        </header>

        <main className="flex flex-1 items-start justify-center px-4 pb-10 pt-2 sm:items-center sm:pt-0">
          <div className="w-full max-w-md">{children}</div>
        </main>

        <footer className="pb-6 text-center text-xs text-muted-foreground">
          Powered by <span className="font-semibold">FitCloud</span> · ©{' '}
          {new Date().getFullYear()} FitCloud, Inc.
        </footer>
      </div>
    </div>
  );
}
