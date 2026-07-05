'use client';

import { useTenant } from '@/features/tenant/tenant-provider';

export function Footer() {
  const tenant = useTenant();
  const year = new Date().getFullYear();

  return (
    <footer className="border-t px-4 py-3 text-center text-xs text-muted-foreground">
      &copy; {year} {tenant.name}. Powered by FitCloud
      {tenant.subscription ? ` — ${tenant.subscription.planName} plan` : ''}.
    </footer>
  );
}
