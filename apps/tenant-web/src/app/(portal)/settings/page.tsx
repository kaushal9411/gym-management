'use client';

import { Bell, KeyRound, MonitorSmartphone, Settings2, ShieldCheck, UserRound } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import * as React from 'react';

import { AccountTab } from '@/features/account-settings/components/account-tab';
import { NotificationsTab } from '@/features/account-settings/components/notifications-tab';
import { PasswordTab } from '@/features/account-settings/components/password-tab';
import { SecurityTab } from '@/features/account-settings/components/security-tab';
import { SessionsTab } from '@/features/account-settings/components/sessions-tab';
import { useIamProfile, useActiveSessions } from '@/features/iam/hooks/use-iam';
import { ReportsHero } from '@/features/reports/components/ui';

type SettingsTab = 'account' | 'password' | 'security' | 'notifications' | 'sessions';

const TABS = [
  { value: 'account', label: 'Account', icon: UserRound },
  { value: 'password', label: 'Password', icon: KeyRound },
  { value: 'security', label: 'Security', icon: ShieldCheck },
  { value: 'notifications', label: 'Notifications', icon: Bell },
  { value: 'sessions', label: 'Sessions', icon: MonitorSmartphone },
];

const isTab = (v: string | null): v is SettingsTab => TABS.some((t) => t.value === v);

export default function SettingsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const requested = searchParams.get('tab');
  const [tab, setTab] = React.useState<SettingsTab>(isTab(requested) ? requested : 'account');
  const profile = useIamProfile();
  const sessions = useActiveSessions();

  const changeTab = (value: string) => {
    if (!isTab(value)) return;
    setTab(value);
    router.replace(`${pathname}?tab=${value}`, { scroll: false });
  };

  const last = profile.data?.lastLoginAt;
  return (
    <div className="space-y-5">
      <ReportsHero
        eyebrow="Account"
        title="Account Settings"
        subtitle="Manage your profile, password and sign-in security."
        accent="members"
        icon={Settings2}
        stats={[
          { label: 'Two-factor', value: profile.data ? (profile.data.mfaEnabled ? 'On' : 'Off') : '—' },
          { label: 'Active sessions', value: sessions.data ? sessions.data.length : '—' },
          ...(last ? [{ label: 'Last sign-in', value: new Date(last).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) }] : []),
        ]}
        tabs={TABS}
        activeTab={tab}
        onTabChange={changeTab}
      />
      {tab === 'account' ? <AccountTab /> : null}
      {tab === 'password' ? <PasswordTab /> : null}
      {tab === 'security' ? <SecurityTab /> : null}
      {tab === 'notifications' ? <NotificationsTab /> : null}
      {tab === 'sessions' ? <SessionsTab /> : null}
    </div>
  );
}
