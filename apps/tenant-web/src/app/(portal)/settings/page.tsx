'use client';

import * as React from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { LogOut, MonitorSmartphone } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useCurrentUser } from '@/features/auth/hooks/use-current-user';
import { useLogoutAllDevices } from '@/features/auth/hooks/use-logout';
import { ChangePasswordForm } from '@/features/auth/components/forms/change-password-form';
import {
  toIamError,
  useActiveSessions,
  useLoginHistory,
  useRevokeSession,
} from '@/features/iam/hooks/use-iam';
import { useTenant } from '@/features/tenant/tenant-provider';

type SettingsTab = 'account' | 'password' | 'notifications' | 'sessions';

const TABS: Array<{ value: SettingsTab; label: string }> = [
  { value: 'account', label: 'Account' },
  { value: 'password', label: 'Password' },
  { value: 'notifications', label: 'Notifications' },
  { value: 'sessions', label: 'Sessions' },
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
    requested === 'password' || requested === 'notifications' || requested === 'sessions' ? requested : 'account',
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
            <CardDescription>
              Notification preferences now live on your profile —{' '}
              <Link href="/profile" className="text-primary underline-offset-4 hover:underline">
                manage them there
              </Link>
              .
            </CardDescription>
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

      {tab === 'sessions' && <SessionsPanel />}
    </div>
  );
}

/** Active devices + login history — session revocation runs through the auth API. */
function SessionsPanel() {
  const sessions = useActiveSessions();
  const revokeSession = useRevokeSession();
  const { logoutAllDevices, isLoggingOut } = useLogoutAllDevices();
  const history = useLoginHistory({ limit: 10 });

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-base">Active sessions</CardTitle>
            <CardDescription>Devices currently signed in to your account.</CardDescription>
          </div>
          <Button variant="outline" size="sm" disabled={isLoggingOut} onClick={() => logoutAllDevices()}>
            <LogOut className="size-4" /> Sign out everywhere
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {sessions.isPending ? (
            Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)
          ) : (sessions.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No active sessions.</p>
          ) : (
            (sessions.data ?? []).map((session) => (
              <div key={session.id} className="flex items-center gap-3 rounded-lg border p-3">
                <MonitorSmartphone className="size-5 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1 text-sm">
                  <div className="truncate font-medium">
                    {session.deviceLabel ?? session.userAgent ?? 'Unknown device'}
                    {session.isCurrent ? <Badge className="ml-2">This device</Badge> : null}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {session.ipAddress ?? 'Unknown IP'} · Active {new Date(session.lastActiveAt).toLocaleString()}
                  </p>
                </div>
                {!session.isCurrent ? (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={revokeSession.isPending}
                    onClick={() =>
                      revokeSession.mutate(session.id, {
                        onSuccess: () => toast.success('Session revoked'),
                        onError: (err) => toast.error(toIamError(err).message),
                      })
                    }
                  >
                    Revoke
                  </Button>
                ) : null}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Login history</CardTitle>
          <CardDescription>Recent sign-in attempts on your account.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {history.isPending ? (
            Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)
          ) : (history.data?.items ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No login history yet.</p>
          ) : (
            (history.data?.items ?? []).map((entry) => (
              <div key={entry.id} className="flex items-center gap-3 text-sm">
                <span
                  className={cn('size-2 shrink-0 rounded-full', entry.success ? 'bg-emerald-500' : 'bg-red-500')}
                  aria-hidden
                />
                <span className="flex-1">
                  {entry.success ? 'Successful sign-in' : `Failed sign-in${entry.reason ? ` (${entry.reason})` : ''}`}
                  <span className="block text-xs text-muted-foreground">
                    {entry.ipAddress ?? 'Unknown IP'} · {new Date(entry.createdAt).toLocaleString()}
                  </span>
                </span>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
