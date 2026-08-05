'use client';

import { RequireMemberAuth } from '@/features/member-portal/guards/require-member-auth';
import { MemberPortalShell } from '@/features/member-portal/components/member-portal-shell';

export default function MemberPortalAuthenticatedLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireMemberAuth>
      <MemberPortalShell>{children}</MemberPortalShell>
    </RequireMemberAuth>
  );
}
