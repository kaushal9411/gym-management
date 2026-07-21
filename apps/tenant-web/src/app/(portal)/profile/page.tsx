'use client';

import * as React from 'react';
import Link from 'next/link';
import { KeyRound } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { AvatarUpload } from '@/features/iam/components/avatar-upload';
import { toIamError, useIamProfile, useUpdateProfile } from '@/features/iam/hooks/use-iam';
import type { ProfileDto } from '@/features/iam/types';

const PREFERENCE_LABELS: Record<string, string> = {
  email_billing: 'Billing & subscription emails',
  email_announcements: 'Platform announcements',
  inapp_system: 'In-app system alerts',
};

export default function ProfilePage() {
  const profile = useIamProfile();

  if (profile.isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }
  if (profile.isError || !profile.data) {
    return <p className="text-sm text-destructive">Couldn&apos;t load your profile — try refreshing.</p>;
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">My Profile</h1>
        <div className="flex flex-wrap items-center gap-1.5 text-muted-foreground">
          <span>Signed in as {profile.data.email} ·</span>
          {profile.data.roles.map((r) => (
            <Badge key={r} variant="secondary">{r}</Badge>
          ))}
        </div>
      </div>
      <ProfileForm profile={profile.data} />
      <NotificationPreferences profile={profile.data} />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Security</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/settings?tab=password">
              <KeyRound className="size-4" /> Change password
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/settings?tab=sessions">Manage sessions &amp; devices</Link>
          </Button>
        </CardContent>
      </Card>
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Profile</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <AvatarUpload name={name} value={avatarUrl} onChange={setAvatarUrl} disabled={updateProfile.isPending} />

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="profile-name">Full name</Label>
            <Input id="profile-name" value={name} onChange={(e) => setName(e.target.value)} disabled={updateProfile.isPending} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="profile-phone">Phone</Label>
            <Input id="profile-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={updateProfile.isPending} />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Emergency contact</Label>
          <div className="grid gap-4 sm:grid-cols-3">
            <Input placeholder="Name" aria-label="Emergency contact name" value={ecName} onChange={(e) => setEcName(e.target.value)} disabled={updateProfile.isPending} />
            <Input placeholder="Phone" aria-label="Emergency contact phone" type="tel" value={ecPhone} onChange={(e) => setEcPhone(e.target.value)} disabled={updateProfile.isPending} />
            <Input placeholder="Relation (e.g. spouse)" aria-label="Emergency contact relation" value={ecRelation} onChange={(e) => setEcRelation(e.target.value)} disabled={updateProfile.isPending} />
          </div>
        </div>

        <Button size="sm" onClick={save} disabled={updateProfile.isPending || name.trim().length < 2}>
          {updateProfile.isPending ? 'Saving…' : 'Save profile'}
        </Button>
      </CardContent>
    </Card>
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
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Notification preferences</CardTitle>
        <CardDescription>Choose what you get notified about.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {Object.entries(prefs).map(([key, value]) => (
          <div key={key} className="flex items-center gap-2">
            <Checkbox
              id={`pref-${key}`}
              checked={value}
              disabled={updateProfile.isPending}
              onCheckedChange={(checked) => toggle(key, checked === true)}
            />
            <Label htmlFor={`pref-${key}`} className="cursor-pointer font-normal">
              {PREFERENCE_LABELS[key] ?? key}
            </Label>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
