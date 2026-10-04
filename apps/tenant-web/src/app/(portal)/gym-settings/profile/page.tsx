'use client';

import * as React from 'react';
import { Building2, Clock3, Contact, Share2 } from 'lucide-react';
import { toast } from 'sonner';

import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { BusinessHoursEditor } from '@/features/gym-settings/components/business-hours-editor';
import { BusinessCardPreview, HoursChart, hoursPerDay } from '@/features/gym-settings/components/previews';
import { Field, SectionCard, SettingsLayout, textareaClassName } from '@/features/gym-settings/components/settings-ui';
import { SettingsHero } from '@/features/gym-settings/components/settings-hero';
import { SetupProgressCard } from '@/features/gym-settings/components/setup-progress';
import { StaggerGroup } from '@/features/reports/components/ui';
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

  const weeklyHours = form ? Math.round(hoursPerDay(form.businessHours).reduce((s, d) => s + d.hours, 0) * 10) / 10 : null;

  const input = (id: keyof FormState & string, extra: React.ComponentProps<typeof Input> = {}) => (
    <Input id={id} value={form ? String(form[id as keyof FormState]) : ''} disabled={!canManage} onChange={(e) => set(id as 'gymName', e.target.value)} {...extra} />
  );

  return (
    <div className="space-y-5">
      <SettingsHero
        title="Gym Profile"
        subtitle="Your gym's identity, legal details, contact info, hours and social links."
        icon={Building2}
        stats={weeklyHours !== null ? [{ label: 'Hours open / week', value: weeklyHours, format: 'number' }] : undefined}
      />

      {profile.isPending || !form ? (
        <div className="space-y-4">
          <Skeleton className="h-48 w-full rounded-[20px]" />
          <Skeleton className="h-48 w-full rounded-[20px]" />
        </div>
      ) : profile.isError ? (
        <p className="text-sm text-destructive">Couldn&apos;t load the gym profile — try refreshing.</p>
      ) : (
        <>
          {canManage ? (
            <UnsavedChangesBar isDirty={isDirty} saving={saving} onSave={() => void handleSave()} onCancel={handleCancel} />
          ) : null}

          <SettingsLayout
            aside={
              <StaggerGroup className="space-y-5">
                <HoursChart value={form.businessHours} />
                <BusinessCardPreview
                  gymName={form.gymName}
                  businessType={form.businessType}
                  description={form.description}
                  email={form.email}
                  phone={form.phone}
                  website={form.website}
                  addressLine={form.addressLine}
                  city={form.city}
                  state={form.state}
                  country={form.country}
                  postalCode={form.postalCode}
                  socialLinks={form.socialLinks}
                />
              </StaggerGroup>
            }
          >
            <StaggerGroup className="space-y-5">
              <SetupProgressCard />

              <SectionCard tone="operations" icon={Building2} title="Basic information" subtitle="Identity and legal details.">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Gym name" htmlFor="gymName" required>
                    {input('gymName')}
                  </Field>
                  <Field label="Legal business name" htmlFor="legalBusinessName">
                    {input('legalBusinessName')}
                  </Field>
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label="Registration number" htmlFor="registrationNumber">
                    {input('registrationNumber')}
                  </Field>
                  <Field label="GST / VAT number" htmlFor="gstVatNumber">
                    {input('gstVatNumber')}
                  </Field>
                  <Field label="Business type" htmlFor="businessType">
                    {input('businessType', { placeholder: 'e.g. Fitness Center' })}
                  </Field>
                </div>
                <Field label="Description" htmlFor="description">
                  <textarea id="description" className={`${textareaClassName} min-h-24`} value={form.description} disabled={!canManage} onChange={(e) => set('description', e.target.value)} />
                </Field>
              </SectionCard>

              <SectionCard tone="members" icon={Contact} title="Contact information" subtitle="How members and partners reach you.">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Email" htmlFor="email">
                    {input('email', { type: 'email' })}
                  </Field>
                  <Field label="Website" htmlFor="website">
                    {input('website', { type: 'url' })}
                  </Field>
                  <Field label="Phone" htmlFor="phone">
                    {input('phone', { type: 'tel' })}
                  </Field>
                  <Field label="Alternate phone" htmlFor="alternatePhone">
                    {input('alternatePhone', { type: 'tel' })}
                  </Field>
                </div>
                <Field label="Address" htmlFor="addressLine">
                  {input('addressLine')}
                </Field>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <Field label="City" htmlFor="city">
                    {input('city')}
                  </Field>
                  <Field label="State" htmlFor="state">
                    {input('state')}
                  </Field>
                  <Field label="Country" htmlFor="country">
                    {input('country')}
                  </Field>
                  <Field label="Postal code" htmlFor="postalCode">
                    {input('postalCode')}
                  </Field>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Latitude" htmlFor="latitude">
                    {input('latitude', { type: 'number', step: 'any' })}
                  </Field>
                  <Field label="Longitude" htmlFor="longitude">
                    {input('longitude', { type: 'number', step: 'any' })}
                  </Field>
                </div>
              </SectionCard>

              <SectionCard tone="attendance" icon={Clock3} title="Business hours" subtitle="Opening and closing time for each day.">
                <BusinessHoursEditor value={form.businessHours} disabled={!canManage} onChange={(businessHours) => set('businessHours', businessHours)} />
              </SectionCard>

              <SectionCard tone="staff" icon={Share2} title="Social media links">
                <SocialLinksEditor value={form.socialLinks} disabled={!canManage} onChange={(socialLinks) => set('socialLinks', socialLinks)} />
              </SectionCard>
            </StaggerGroup>
          </SettingsLayout>
        </>
      )}
    </div>
  );
}
