'use client';

import * as React from 'react';
import { Crown, ShieldCheck, ClipboardList, Dumbbell, KeyRound, Smartphone } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { toast } from 'sonner';

import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { SectionCard, SettingsLayout, StatusChip } from '@/features/gym-settings/components/settings-ui';
import { SettingsHero } from '@/features/gym-settings/components/settings-hero';
import { PreviewCard } from '@/features/gym-settings/components/settings-ui';
import { StaggerGroup } from '@/features/reports/components/ui';
import { accentChipStyle, type ReportAccent } from '@/features/reports/lib/reports-theme';
import { UnsavedChangesBar } from '@/features/gym-settings/components/unsaved-changes-bar';
import { toGymSettingsError, useSecuritySettings, useUpdateSecuritySettings } from '@/features/gym-settings/hooks/use-gym-settings';
import type { StaffRoleName } from '@/features/gym-settings/types';

const ROLE_OPTIONS: Array<{ value: StaffRoleName; label: string; description: string; icon: LucideIcon; tone: ReportAccent }> = [
  { value: 'OWNER', label: 'Owner', description: 'Full control of the gym account and billing.', icon: Crown, tone: 'finance' },
  { value: 'MANAGER', label: 'Manager', description: 'Runs day-to-day operations across branches.', icon: ShieldCheck, tone: 'operations' },
  { value: 'TRAINER', label: 'Trainer', description: 'Manages workout/diet plans and member sessions.', icon: Dumbbell, tone: 'staff' },
  { value: 'RECEPTIONIST', label: 'Receptionist', description: 'Front-desk check-ins, payments, and bookings.', icon: ClipboardList, tone: 'members' },
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
      <SettingsHero
        title="Security"
        subtitle="Require two-factor authentication for specific staff roles before they can log in."
        icon={ShieldCheck}
        stats={selected ? [{ label: 'Roles requiring 2FA', value: selected.length, format: 'number' }] : undefined}
      />

      {security.isPending || !selected ? (
        <Skeleton className="h-64 w-full rounded-[20px]" />
      ) : security.isError ? (
        <p className="text-sm text-destructive">Couldn&apos;t load security settings — try refreshing.</p>
      ) : (
        <>
          {canManage ? (
            <UnsavedChangesBar isDirty={isDirty} saving={updateSecurity.isPending} onSave={handleSave} onCancel={handleCancel} />
          ) : null}

          <SettingsLayout
            aside={
              <StaggerGroup className="space-y-5">
                <PreviewCard title="How 2FA works" subtitle="Static explanation" icon={KeyRound} tone="staff">
                  <ol className="space-y-3 text-sm">
                    {[
                      { icon: ShieldCheck, text: 'A staff member in a checked role logs in.' },
                      { icon: Smartphone, text: 'They are walked through setting up an authenticator app and backup codes.' },
                      { icon: KeyRound, text: 'Every later login asks for a 6-digit code.' },
                    ].map((step, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg" style={accentChipStyle('staff')}>
                          <step.icon className="size-4" aria-hidden />
                        </span>
                        <span className="pt-1 text-muted-foreground">{step.text}</span>
                      </li>
                    ))}
                  </ol>
                </PreviewCard>
              </StaggerGroup>
            }
          >
            <StaggerGroup className="space-y-5">
              <SectionCard
                tone="staff"
                icon={ShieldCheck}
                title="Mandatory two-factor authentication"
                subtitle="Staff in a checked role must set up 2FA the next time they log in — no separate invite needed."
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  {ROLE_OPTIONS.map((role) => {
                    const on = selected.includes(role.value);
                    return (
                      <label
                        key={role.value}
                        htmlFor={`mfa-role-${role.value}`}
                        className={`flex items-start gap-3 rounded-xl border p-4 transition-all duration-200 ${canManage ? 'cursor-pointer hover:-translate-y-0.5 hover:shadow-sm' : ''} ${on ? 'border-primary/40 bg-primary/5' : 'bg-muted/20'}`}
                      >
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl" style={accentChipStyle(role.tone)}>
                          <role.icon className="size-5" aria-hidden />
                        </span>
                        <span className="block min-w-0 flex-1 text-sm font-semibold">
                          {role.label}
                          <span className="block text-xs font-normal text-muted-foreground">{role.description}</span>
                          <span className="mt-2 block">
                            <StatusChip tone={on ? 'good' : 'muted'}>{on ? '2FA required' : 'Optional'}</StatusChip>
                          </span>
                        </span>
                        <Checkbox
                          id={`mfa-role-${role.value}`}
                          checked={on}
                          disabled={!canManage}
                          onCheckedChange={(checked) => toggle(role.value, checked === true)}
                          className="mt-0.5"
                        />
                      </label>
                    );
                  })}
                </div>
              </SectionCard>
            </StaggerGroup>
          </SettingsLayout>
        </>
      )}
    </div>
  );
}
