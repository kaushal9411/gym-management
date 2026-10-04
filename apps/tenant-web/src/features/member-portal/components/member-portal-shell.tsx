'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';

import { useMemberAuth, useMemberLogout } from '../hooks/use-member-auth';
import { useMemberProfile, useMemberUnreadCount } from '../hooks/use-member-portal';
import { BottomTabBar } from './shell/bottom-tab-bar';
import { PortalPage } from './shell/portal-page';
import { SideRail } from './shell/side-rail';
import { TopBar } from './shell/top-bar';

/**
 * Phone-first member portal shell. <md: sticky `TopBar` + fixed `BottomTabBar`
 * (+ "More" sheet); >=md: sticky `SideRail`. Nav comes from `lib/nav.ts`
 * (`PORTAL_NAV`). The shell owns page width/gutters (max 1200px, 16px
 * gutters on phones) and bottom padding so the tab bar never covers content -
 * pages render plain content (no PageContainer, no extra outer padding).
 * Logout behaviour unchanged (`useMemberLogout`).
 */
export function MemberPortalShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { member } = useMemberAuth();
  const logout = useMemberLogout();
  const { data: profile } = useMemberProfile();
  const unread = useMemberUnreadCount();
  const shared = {
    name: profile?.name ?? member?.name,
    memberId: member?.memberId,
    photoUrl: profile?.profilePhotoUrl ?? null,
    unread,
    onLogout: () => logout.mutate(),
    loggingOut: logout.isPending,
  };

  return (
    <div className="flex min-h-dvh">
      <SideRail pathname={pathname} {...shared} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar {...shared} />
        <main className="flex-1 overflow-x-clip bg-muted/20 pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:pb-10">
          <div className="w-full px-2.5 py-4 md:py-6">
            <PortalPage>{children}</PortalPage>
          </div>
        </main>
      </div>
      <BottomTabBar pathname={pathname} unread={unread} />
    </div>
  );
}
