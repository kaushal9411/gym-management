'use client';

import * as React from 'react';
import { BellRing, CalendarDays, HelpCircle, KeyRound, Laptop, Phone, ShieldCheck, UserRound, HeartPulse } from 'lucide-react';
import { toast } from 'sonner';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoadingButton } from '@/components/ui/loading-button';
import { Skeleton } from '@/components/ui/skeleton';
import { AccentPanel } from '@/features/account-settings/components/settings-ui';
import { AvatarUpload } from '@/features/iam/components/avatar-upload';
import { toIamError, useIamProfile, useUpdateProfile } from '@/features/iam/hooks/use-iam';
import type { ProfileDto } from '@/features/iam/types';
import { CompletenessGauge, PrefSwitch, QuickLinkCard } from '@/features/profile/components/profile-ui';
import { ReportsHero, StaggerGroup, StaggerItem } from '@/features/reports/components/ui';

const PREFERENCE_LABELS: Record<string, string> = {
  email_billing: 'Billing & subscription emails',
  email_announcements: 'Platform announcements',
  inapp_system: 'In-app system alerts',
};

const fmtDate = (iso: string | null): string =>
  iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : 'Never';

function initialsOf(name: string): string {
  return name.split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || '?';
}

/** Completeness is computed only from real, saved profile fields. */
function completeness(p: ProfileDto): { percent: number; done: number; total: number } {
  const checks = [
    p.name.trim().length >= 2,
    !!p.phone,
    !!p.avatarUrl,
    !!p.emergencyContact.name,
    !!p.emergencyContact.phone,
    !!p.emergencyContact.relation,
    !!p.emailVerifiedAt,
    p.mfaEnabled,
  ];
  const done = checks.filter(Boolean).length;
  return { percent: Math.round((done / checks.length) * 100), done, total: checks.length };
}

export default function ProfilePage() {
  const profile = useIamProfile();

  if (profile.isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-44 w-full rounded-[22px]" />
        <Skeleton className="h-64 w-full rounded-[20px]" />
        <Skeleton className="h-48 w-full rounded-[20px]" />
      </div>
    );
  }
  if (profile.isError || !profile.data) {
    return <p className="text-sm text-destructive">Couldn&apos;t load your profile — try refreshing.</p>;
  }
  return <ProfileContent profile={profile.data} />;
}

function ProfileContent({ profile }: { profile: ProfileDto }) {
  const gauge = completeness(profile);

  // Scroll to the notification preferences when opened via /profile#notifications (the menu link).
  React.useEffect(() => {
    const go = () => {
      if (window.location.hash === '#notifications') {
        document.getElementById('notifications')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    };
    const t = window.setTimeout(go, 150);
    window.addEventListener('hashchange', go);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('hashchange', go);
    };
  }, []);

  const branches = profile.branchAccess.allBranches ? ['All branches'] : profile.branchAccess.branches.map((b) => b.branchName);

  return (
    <div className="space-y-5">
      <ReportsHero
        eyebrow="Account"
        title={profile.name}
        accent="members"
        icon={UserRound}
        subtitle={
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 break-all">{profile.email}</span>
            {profile.roles.map((r) => (
              <span key={r} className="rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-bold">{r}</span>
            ))}
            {branches.map((b) => (
              <span key={b} className="rounded-full bg-black/20 px-2 py-0.5 text-[11px] font-semibold">{b}</span>
            ))}
          </span>
        }
        stats={[
          { label: 'Profile complete', value: gauge.percent, format: 'percent' },
          { label: 'Member since', value: fmtDate(profile.createdAt) },
          { label: 'Last sign-in', value: fmtDate(profile.lastLoginAt) },
          { label: 'Two-factor', value: profile.mfaEnabled ? 'On' : 'Off' },
        ]}
        aside={
          <Avatar className="size-20 ring-4 ring-white/50">
            {profile.avatarUrl ? <AvatarImage src={profile.avatarUrl} alt={profile.name} /> : null}
            <AvatarFallback className="bg-white/20 text-2xl font-extrabold text-white">{initialsOf(profile.name)}</AvatarFallback>
          </Avatar>
        }
      />

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-5">
          <ProfileForm profile={profile} />
          <NotificationPreferences profile={profile} />
        </div>
        <div className="min-w-0 space-y-5">
          <AccentPanel title="Completeness" subtitle="Based on your saved details" icon={ShieldCheck} accent="members">
            <CompletenessGauge {...gauge} />
          </AccentPanel>
          <StaggerGroup className="grid gap-3" step={0.07}>
            <StaggerItem><QuickLinkCard href="/settings?tab=password" label="Change password" hint="Update your password" icon={KeyRound} accent="staff" /></StaggerItem>
            <StaggerItem><QuickLinkCard href="/settings?tab=security" label="Security (2FA)" hint={profile.mfaEnabled ? 'Two-factor is on' : 'Add a second step'} icon={ShieldCheck} accent="operations" /></StaggerItem>
            <StaggerItem><QuickLinkCard href="/settings?tab=sessions" label="Sessions & devices" hint="Where you're signed in" icon={Laptop} accent="attendance" /></StaggerItem>
            <StaggerItem><QuickLinkCard href="/support" label="Help Center" hint="Guides & tickets" icon={HelpCircle} accent="finance" /></StaggerItem>
          </StaggerGroup>
        </div>
      </div>
    </div>
  );
}

function ProfileForm({ profile }: { profile: ProfileDto }) {
  const updateProfile = useUpdateProfile();
  const [name, setName] = React.useState(profile.name);
  const [phone, setPhone] = React.useState(profile.phone ?? '');
  const [avatarUrl, setAvatarUrl] = React.useState<string | null>(profile.avatarUrl);
  const [ecName, setEcName] = React.useState(profile.emergencyContact.name ?? '');
  const [ecPhone, setEcPhone] = React.useState(profile.emergencyContact.phone ?? '');
  const [ecRelation, setEcRelation] = React.useState(profile.emergencyContact.relation ?? '');

  const save = () =>
    updateProfile.mutate(
      {
        name,
        phone: phone || null,
        avatarUrl,
        emergencyContactName: ecName || null,
        emergencyContactPhone: ecPhone || null,
        emergencyContactRelation: ecRelation || null,
      },
      {
        onSuccess: () => toast.success('Profile saved'),
        onError: (err) => toast.error(toIamError(err).message),
      },
    );

  const busy = updateProfile.isPending;

  return (
    <div className="space-y-5">
      <AccentPanel title="Personal details" subtitle="Your photo, name and phone" icon={UserRound} accent="members">
        <div className="space-y-5">
          <AvatarUpload name={name} value={avatarUrl} onChange={setAvatarUrl} disabled={busy} />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="profile-name" required>Full name</Label>
              <Input id="profile-name" value={name} onChange={(e) => setName(e.target.value)} disabled={busy} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-phone">Phone</Label>
              <div className="relative">
                <Phone className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <Input id="profile-phone" type="tel" className="pl-9" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={busy} />
              </div>
            </div>
          </div>
        </div>
      </AccentPanel>

      <AccentPanel title="Emergency contact" subtitle="Who we should call if needed" icon={HeartPulse} accent="attendance">
        <div className="grid gap-4 sm:grid-cols-3">
          <Input placeholder="Name" aria-label="Emergency contact name" value={ecName} onChange={(e) => setEcName(e.target.value)} disabled={busy} />
          <Input placeholder="Phone" aria-label="Emergency contact phone" type="tel" value={ecPhone} onChange={(e) => setEcPhone(e.target.value)} disabled={busy} />
          <Input placeholder="Relation (e.g. spouse)" aria-label="Emergency contact relation" value={ecRelation} onChange={(e) => setEcRelation(e.target.value)} disabled={busy} />
        </div>
      </AccentPanel>

      {/* No dirty-state logic existed on this page, so the original explicit Save button UX is kept. */}
      <div className="flex items-center justify-between gap-3 rounded-2xl border bg-card px-4 py-3 shadow-xs">
        <span className="flex items-center gap-2 text-sm text-muted-foreground">
          <CalendarDays className="size-4" aria-hidden /> Name, phone, photo and emergency contact save together.
        </span>
        <LoadingButton size="sm" onClick={save} disabled={name.trim().length < 2} loading={busy} loadingText="Saving…">
          Save profile
        </LoadingButton>
      </div>
    </div>
  );
}

function NotificationPreferences({ profile }: { profile: ProfileDto }) {
  const updateProfile = useUpdateProfile();
  const [prefs, setPrefs] = React.useState(profile.notificationPreferences);

  const toggle = (key: string, value: boolean) => {
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    updateProfile.mutate(
      { notificationPreferences: next },
      {
        onSuccess: () => toast.success('Preferences saved'),
        onError: (err) => {
          setPrefs(prefs); // revert optimistic change
          toast.error(toIamError(err).message);
        },
      },
    );
  };

  return (
    <div id="notifications" className="scroll-mt-20">
      <AccentPanel title="Notification preferences" subtitle="Choose what you get notified about. Changes save instantly." icon={BellRing} accent="analytics">
        <div className="space-y-2.5">
          {Object.entries(prefs).map(([key, value]) => (
            <PrefSwitch
              key={key}
              id={`pref-${key}`}
              label={PREFERENCE_LABELS[key] ?? key}
              checked={value}
              disabled={updateProfile.isPending}
              onChange={(checked) => toggle(key, checked)}
            />
          ))}
        </div>
      </AccentPanel>
    </div>
  );
}
