import { AppShell } from '@/components/layout/app-shell';
import { PageContainer } from '@/components/ui/page-container';
import { RequireAuth } from '@/features/auth/guards/require-auth';
import { RequireSubscription } from '@/features/auth/guards/require-subscription';
import { RequireFeatureRoute } from '@/features/navigation/require-feature-route';
import { TenantFlagsRefresher } from '@/features/tenant/tenant-flags-refresher';

/**
 * Shell for every private, authenticated route: the full application
 * chrome (collapsible sidebar, header, footer) built in Prompt 10.
 * Future modules (Members, Staff, ...) render inside `<PageContainer>`
 * without needing to touch this layout. `<RequireFeatureRoute>` blocks the
 * routes of disabled modules; `<TenantFlagsRefresher>` keeps
 * `tenant.featureFlags` fresh (focus / 60 s / module-unavailable 403).
 */
export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <RequireSubscription>
        <AppShell>
          <TenantFlagsRefresher />
          <PageContainer>
            <RequireFeatureRoute>{children}</RequireFeatureRoute>
          </PageContainer>
        </AppShell>
      </RequireSubscription>
    </RequireAuth>
  );
}
