import { AppShell } from '@/components/layout/app-shell';
import { PageContainer } from '@/components/ui/page-container';
import { RequireAuth } from '@/features/auth/guards/require-auth';
import { RequireSubscription } from '@/features/auth/guards/require-subscription';

/**
 * Shell for every private, authenticated route: the full application
 * chrome (collapsible sidebar, header, footer) built in Prompt 10.
 * Future modules (Members, Staff, ...) render inside `<PageContainer>`
 * without needing to touch this layout.
 */
export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <RequireSubscription>
        <AppShell>
          <PageContainer>{children}</PageContainer>
        </AppShell>
      </RequireSubscription>
    </RequireAuth>
  );
}
