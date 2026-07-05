'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useCurrentUser } from '@/features/auth/hooks/use-current-user';
import { ChangePasswordForm } from '@/features/auth/components/forms/change-password-form';
import { useTenant } from '@/features/tenant/tenant-provider';

type SettingsTab = 'account' | 'password' | 'notifications';

const TABS: Array<{ value: SettingsTab; label: string }> = [
  { value: 'account', label: 'Account' },
  { value: 'password', label: 'Password' },
  { value: 'notifications', label: 'Notifications' },
];

const NOTIFICATION_PREFERENCES = [
  { key: 'email-billing', label: 'Billing & subscription emails' },
  { key: 'email-announcements', label: 'Platform announcements' },
  { key: 'inapp-system', label: 'In-app system alerts' },
] as const;

export default function SettingsPage() {
  const searchParams = useSearchParams();
  const requested = searchParams.get('tab');
  const [tab, setTab] = React.useState<SettingsTab>(
    requested === 'password' || requested === 'notifications' ? requested : 'account',
  );

  const user = useCurrentUser();
  const tenant = useTenant();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Account Settings</h1>
        <p className="text-muted-foreground">Manage your profile, password, and notification preferences.</p>
      </div>

      <div className="inline-flex rounded-md border p-0.5">
        {TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setTab(t.value)}
            className={cn(
              'rounded px-3 py-1.5 text-sm font-medium transition-colors',
              tab === t.value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'account' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Account details</CardTitle>
            <CardDescription>Edit your name, email, and photo from the Profile page.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p><span className="text-muted-foreground">Name:</span> {user?.name}</p>
            <p><span className="text-muted-foreground">Email:</span> {user?.email}</p>
            <p><span className="text-muted-foreground">Role:</span> {user?.role}</p>
            <p><span className="text-muted-foreground">Gym:</span> {tenant.name}</p>
          </CardContent>
        </Card>
      )}

      {tab === 'password' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Change password</CardTitle>
            <CardDescription>Changing your password signs you out of every other session.</CardDescription>
          </CardHeader>
          <CardContent>
            <ChangePasswordForm />
          </CardContent>
        </Card>
      )}

      {tab === 'notifications' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Notification preferences</CardTitle>
            <CardDescription>Choose what you get notified about. Saving preferences arrives with the Notifications module.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {NOTIFICATION_PREFERENCES.map((pref) => (
              <div key={pref.key} className="flex items-center gap-2">
                <Checkbox id={pref.key} defaultChecked disabled />
                <Label htmlFor={pref.key} className="font-normal text-muted-foreground">
                  {pref.label}
                </Label>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
