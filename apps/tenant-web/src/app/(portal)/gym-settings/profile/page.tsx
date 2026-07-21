'use client';

import * as React from 'react';
import { toast } from 'sonner';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { BusinessHoursEditor } from '@/features/gym-settings/components/business-hours-editor';
import { GymSettingsNav } from '@/features/gym-settings/components/gym-settings-nav';
import { SocialLinksEditor } from '@/features/gym-settings/components/social-links-editor';
import { UnsavedChangesBar } from '@/features/gym-settings/components/unsaved-changes-bar';
import {
  toGymSettingsError,
  useGymProfile,
  useUpdateBusinessHours,
  useUpdateContactInfo,
  useUpdateGymProfile,
  useUpdateSocialLinks,
} from '@/features/gym-settings/hooks/use-gym-settings';
import type { BusinessHours, GymProfile, SocialLinks } from '@/features/gym-settings/types';

interface FormState {
  gymName: string;
  legalBusinessName: string;
  registrationNumber: string;
  gstVatNumber: string;
  businessType: string;
  description: string;
  email: string;
  phone: string;
  alternatePhone: string;
  website: string;
  addressLine: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  latitude: string;
  longitude: string;
  businessHours: BusinessHours;
  socialLinks: SocialLinks;
}

function toFormState(profile: GymProfile): FormState {
  return {
    gymName: profile.gymName,
    legalBusinessName: profile.legalBusinessName ?? '',
    registrationNumber: profile.registrationNumber ?? '',
    gstVatNumber: profile.gstVatNumber ?? '',
    businessType: profile.businessType ?? '',
    description: profile.description ?? '',
    email: profile.email ?? '',
    phone: profile.phone ?? '',
    alternatePhone: profile.alternatePhone ?? '',
    website: profile.website ?? '',
    addressLine: profile.addressLine ?? '',
    city: profile.city ?? '',
    state: profile.state ?? '',
    country: profile.country ?? '',
    postalCode: profile.postalCode ?? '',
    latitude: profile.latitude?.toString() ?? '',
    longitude: profile.longitude?.toString() ?? '',
    businessHours: profile.businessHours ?? {},
    socialLinks: profile.socialLinks ?? {},
  };
}

export default function GymProfilePage() {
  const { hasPermission } = usePermissions();
  const canManage = hasPermission('settings:manage');
  const profile = useGymProfile();

  const updateProfile = useUpdateGymProfile();
  const updateContact = useUpdateContactInfo();
  const updateHours = useUpdateBusinessHours();
  const updateSocial = useUpdateSocialLinks();
  const saving = updateProfile.isPending || updateContact.isPending || updateHours.isPending || updateSocial.isPending;

  const [form, setForm] = React.useState<FormState | null>(null);

  React.useEffect(() => {
    if (profile.data && !form) setForm(toFormState(profile.data));
  }, [profile.data, form]);

  const isDirty = !!profile.data && !!form && JSON.stringify(form) !== JSON.stringify(toFormState(profile.data));

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));

  const handleCancel = () => {
    if (profile.data) setForm(toFormState(profile.data));
  };

  const handleSave = async () => {
    if (!form) return;
    try {
      await Promise.all([
        updateProfile.mutateAsync({
          gymName: form.gymName,
          legalBusinessName: form.legalBusinessName || null,
          registrationNumber: form.registrationNumber || null,
          gstVatNumber: form.gstVatNumber || null,
          businessType: form.businessType || null,
          description: form.description || null,
        }),
        updateContact.mutateAsync({
          email: form.email || null,
          phone: form.phone || null,
          alternatePhone: form.alternatePhone || null,
          website: form.website || null,
          addressLine: form.addressLine || null,
          city: form.city || null,
          state: form.state || null,
          country: form.country || null,
          postalCode: form.postalCode || null,
          latitude: form.latitude ? Number(form.latitude) : null,
          longitude: form.longitude ? Number(form.longitude) : null,
        }),
        updateHours.mutateAsync(form.businessHours),
        updateSocial.mutateAsync(form.socialLinks),
      ]);
      toast.success('Gym profile saved');
    } catch (error) {
      toast.error(toGymSettingsError(error).message);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Gym Profile</h1>
        <p className="text-muted-foreground">Your gym&apos;s identity, legal details, contact info, hours and social links.</p>
      </div>

      <GymSettingsNav />

      {profile.isPending || !form ? (
        <div className="space-y-4">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : profile.isError ? (
        <p className="text-sm text-destructive">Couldn&apos;t load the gym profile — try refreshing.</p>
      ) : (
        <>
          {canManage ? (
            <UnsavedChangesBar isDirty={isDirty} saving={saving} onSave={() => void handleSave()} onCancel={handleCancel} />
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Basic information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="gymName">Gym name</Label>
                  <Input id="gymName" value={form.gymName} disabled={!canManage} onChange={(e) => set('gymName', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="legalBusinessName">Legal business name</Label>
                  <Input
                    id="legalBusinessName"
                    value={form.legalBusinessName}
                    disabled={!canManage}
                    onChange={(e) => set('legalBusinessName', e.target.value)}
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="registrationNumber">Registration number</Label>
                  <Input
                    id="registrationNumber"
                    value={form.registrationNumber}
                    disabled={!canManage}
                    onChange={(e) => set('registrationNumber', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="gstVatNumber">GST / VAT number</Label>
                  <Input
                    id="gstVatNumber"
                    value={form.gstVatNumber}
                    disabled={!canManage}
                    onChange={(e) => set('gstVatNumber', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="businessType">Business type</Label>
                  <Input
                    id="businessType"
                    placeholder="e.g. Fitness Center"
                    value={form.businessType}
                    disabled={!canManage}
                    onChange={(e) => set('businessType', e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <textarea
                  id="description"
                  className="flex min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  value={form.description}
                  disabled={!canManage}
                  onChange={(e) => set('description', e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Contact information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" value={form.email} disabled={!canManage} onChange={(e) => set('email', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="website">Website</Label>
                  <Input id="website" type="url" value={form.website} disabled={!canManage} onChange={(e) => set('website', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input id="phone" type="tel" value={form.phone} disabled={!canManage} onChange={(e) => set('phone', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="alternatePhone">Alternate phone</Label>
                  <Input
                    id="alternatePhone"
                    type="tel"
                    value={form.alternatePhone}
                    disabled={!canManage}
                    onChange={(e) => set('alternatePhone', e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="addressLine">Address</Label>
                <Input id="addressLine" value={form.addressLine} disabled={!canManage} onChange={(e) => set('addressLine', e.target.value)} />
              </div>
              <div className="grid gap-4 sm:grid-cols-4">
                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input id="city" value={form.city} disabled={!canManage} onChange={(e) => set('city', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">State</Label>
                  <Input id="state" value={form.state} disabled={!canManage} onChange={(e) => set('state', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="country">Country</Label>
                  <Input id="country" value={form.country} disabled={!canManage} onChange={(e) => set('country', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="postalCode">Postal code</Label>
                  <Input id="postalCode" value={form.postalCode} disabled={!canManage} onChange={(e) => set('postalCode', e.target.value)} />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="latitude">Latitude</Label>
                  <Input
                    id="latitude"
                    type="number"
                    step="any"
                    value={form.latitude}
                    disabled={!canManage}
                    onChange={(e) => set('latitude', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="longitude">Longitude</Label>
                  <Input
                    id="longitude"
                    type="number"
                    step="any"
                    value={form.longitude}
                    disabled={!canManage}
                    onChange={(e) => set('longitude', e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Business hours</CardTitle>
            </CardHeader>
            <CardContent>
              <BusinessHoursEditor
                value={form.businessHours}
                disabled={!canManage}
                onChange={(businessHours) => set('businessHours', businessHours)}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Social media links</CardTitle>
            </CardHeader>
            <CardContent>
              <SocialLinksEditor
                value={form.socialLinks}
                disabled={!canManage}
                onChange={(socialLinks) => set('socialLinks', socialLinks)}
              />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
