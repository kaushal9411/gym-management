'use client';

import * as React from 'react';
import { ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { GymSettingsNav } from '@/features/gym-settings/components/gym-settings-nav';
import { UnsavedChangesBar } from '@/features/gym-settings/components/unsaved-changes-bar';
import { toGymSettingsError, useSecuritySettings, useUpdateSecuritySettings } from '@/features/gym-settings/hooks/use-gym-settings';
import type { StaffRoleName } from '@/features/gym-settings/types';

const ROLE_OPTIONS: Array<{ value: StaffRoleName; label: string; description: string }> = [
  { value: 'OWNER', label: 'Owner', description: 'Full control of the gym account and billing.' },
  { value: 'MANAGER', label: 'Manager', description: 'Runs day-to-day operations across branches.' },
  { value: 'TRAINER', label: 'Trainer', description: 'Manages workout/diet plans and member sessions.' },
  { value: 'RECEPTIONIST', label: 'Receptionist', description: 'Front-desk check-ins, payments, and bookings.' },
];

export default function SecuritySettingsPage() {
  const { hasPermission } = usePermissions();
  const canManage = hasPermission('settings:manage');

  const security = useSecuritySettings();
  const updateSecurity = useUpdateSecuritySettings();

  const [selected, setSelected] = React.useState<StaffRoleName[] | null>(null);

  React.useEffect(() => {
    if (security.data && !selected) setSelected(security.data.mfaRequiredRoles);
  }, [security.data, selected]);

  const baseline = security.data?.mfaRequiredRoles ?? null;
  const isDirty = !!selected && !!baseline && JSON.stringify([...selected].sort()) !== JSON.stringify([...baseline].sort());

  const toggle = (role: StaffRoleName, checked: boolean) => {
    setSelected((prev) => {
      const current = prev ?? [];
      return checked ? [...current, role] : current.filter((r) => r !== role);
    });
  };

  const handleCancel = () => {
    if (baseline) setSelected(baseline);
  };

  const handleSave = () => {
    if (!selected) return;
    updateSecurity.mutate(
      { mfaRequiredRoles: selected },
      {
        onSuccess: () => toast.success('Security settings saved'),
        onError: (err) => toast.error(toGymSettingsError(err).message),
      },
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15">
          <ShieldCheck className="size-5" aria-hidden />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Security</h1>
          <p className="text-muted-foreground">Require two-factor authentication for specific staff roles before they can log in.</p>
        </div>
      </div>

      <GymSettingsNav />

      {security.isPending || !selected ? (
        <Skeleton className="h-64 w-full" />
      ) : security.isError ? (
        <p className="text-sm text-destructive">Couldn&apos;t load security settings — try refreshing.</p>
      ) : (
        <>
          {canManage ? (
            <UnsavedChangesBar isDirty={isDirty} saving={updateSecurity.isPending} onSave={handleSave} onCancel={handleCancel} />
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Mandatory two-factor authentication</CardTitle>
              <CardDescription>
                Staff in a checked role must set up 2FA (an authenticator app + backup codes) the next time they log in — they&apos;re walked through
                setup automatically, no separate invite needed.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {ROLE_OPTIONS.map((role) => (
                <label
                  key={role.value}
                  htmlFor={`mfa-role-${role.value}`}
                  className="flex items-start gap-3 rounded-lg border p-3.5 transition-colors hover:bg-muted/40"
                >
                  <Checkbox
                    id={`mfa-role-${role.value}`}
                    checked={selected.includes(role.value)}
                    disabled={!canManage}
                    onCheckedChange={(checked) => toggle(role.value, checked === true)}
                    className="mt-0.5"
                  />
                  <span className="block text-sm font-medium">
                    {role.label}
                    <span className="block text-xs font-normal text-muted-foreground">{role.description}</span>
                  </span>
                </label>
              ))}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
