'use client';

import { RequireAuth } from '@/features/auth/guards/require-auth';
import { PortalShell } from '@/features/shell/components/portal-shell';

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <PortalShell>{children}</PortalShell>
    </RequireAuth>
  );
}
