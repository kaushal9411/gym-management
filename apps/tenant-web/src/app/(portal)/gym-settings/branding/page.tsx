'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ImageIcon, Palette } from 'lucide-react';
import { toast } from 'sonner';

import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { ColorPicker } from '@/features/gym-settings/components/color-picker';
import { BrandingPreview } from '@/features/gym-settings/components/previews';
import { Field, SectionCard, SettingsLayout, selectClassName } from '@/features/gym-settings/components/settings-ui';
import { SettingsHero } from '@/features/gym-settings/components/settings-hero';
import { StaggerGroup } from '@/features/reports/components/ui';
import { ImageUploadField } from '@/features/gym-settings/components/image-upload-field';
import { UnsavedChangesBar } from '@/features/gym-settings/components/unsaved-changes-bar';
import {
  toGymSettingsError,
  useGymProfile,
  useBranding,
  useUpdateBranding,
  useUploadBrandingAsset,
  useUploadFavicon,
  useUploadLogo,
} from '@/features/gym-settings/hooks/use-gym-settings';
import type { ThemePreference } from '@/features/gym-settings/types';

interface ColorForm {
  primaryColor: string;
  secondaryColor: string;
  theme: ThemePreference;
  welcomeMessage: string;
}

export default function BrandingPage() {
  const router = useRouter();
  const { hasPermission } = usePermissions();
  const canManage = hasPermission('settings:manage');

  const branding = useBranding();
  const updateBranding = useUpdateBranding();
  const uploadLogo = useUploadLogo();
  const uploadFavicon = useUploadFavicon();
  const uploadAsset = useUploadBrandingAsset();

  const [form, setForm] = React.useState<ColorForm | null>(null);

  React.useEffect(() => {
    if (branding.data && !form) {
      setForm({
        primaryColor: branding.data.primaryColor,
        secondaryColor: branding.data.secondaryColor ?? '',
        theme: branding.data.theme,
        welcomeMessage: branding.data.welcomeMessage ?? '',
      });
    }
  }, [branding.data, form]);

  const baseline: ColorForm | null = branding.data
    ? {
        primaryColor: branding.data.primaryColor,
        secondaryColor: branding.data.secondaryColor ?? '',
        theme: branding.data.theme,
        welcomeMessage: branding.data.welcomeMessage ?? '',
      }
    : null;
  const isDirty = JSON.stringify(form) !== JSON.stringify(baseline);

  // Every branding write invalidates the tenant cache server-side (see
  // settings.service.ts) — refreshing the server-rendered root layout here
  // is what makes the sidebar/login logo & colors update without a hard reload.
  const refreshPortalChrome = () => router.refresh();

  const handleCancel = () => {
    if (baseline) setForm(baseline);
  };

  const handleSave = async () => {
    if (!form) return;
    try {
      await updateBranding.mutateAsync({
        primaryColor: form.primaryColor,
        secondaryColor: form.secondaryColor || undefined,
        theme: form.theme,
        welcomeMessage: form.welcomeMessage || undefined,
      });
      toast.success('Theme colors saved');
      refreshPortalChrome();
    } catch (error) {
      toast.error(toGymSettingsError(error).message);
    }
  };

  const handleUpload = async (
    kind: 'logo' | 'favicon' | 'loginBackgroundUrl' | 'dashboardBannerUrl' | 'emailLogoUrl',
    dataUrl: string,
    onProgress: (percent: number) => void,
  ) => {
    const onUploadProgress = (event: { loaded: number; total?: number }) => {
      const total = event.total ?? event.loaded;
      onProgress(total > 0 ? Math.round((event.loaded / total) * 100) : 0);
    };
    try {
      if (kind === 'logo') await uploadLogo.mutateAsync({ dataUrl, onUploadProgress });
      else if (kind === 'favicon') await uploadFavicon.mutateAsync({ dataUrl, onUploadProgress });
      else await uploadAsset.mutateAsync({ field: kind, dataUrl, onUploadProgress });
      toast.success('Image uploaded');
      refreshPortalChrome();
    } catch (error) {
      toast.error(toGymSettingsError(error).message);
    }
  };

  const profile = useGymProfile();
  const uploadedCount = branding.data ? [branding.data.logoUrl, branding.data.faviconUrl, branding.data.loginBackgroundUrl, branding.data.dashboardBannerUrl, branding.data.emailLogoUrl].filter(Boolean).length : null;

  return (
    <div className="space-y-5">
      <SettingsHero
        title="Branding"
        subtitle="Your gym's colors, logo, and images across the portal, login, and emails."
        icon={Palette}
        stats={uploadedCount !== null ? [{ label: 'Images uploaded (of 5)', value: uploadedCount, format: 'number' }] : undefined}
      />

      {branding.isPending || !form ? (
        <div className="space-y-4">
          <Skeleton className="h-48 w-full rounded-[20px]" />
          <Skeleton className="h-48 w-full rounded-[20px]" />
        </div>
      ) : branding.isError ? (
        <p className="text-sm text-destructive">Couldn&apos;t load branding — try refreshing.</p>
      ) : (
        <>
          {canManage ? (
            <UnsavedChangesBar isDirty={isDirty} saving={updateBranding.isPending} onSave={() => void handleSave()} onCancel={handleCancel} />
          ) : null}

          <SettingsLayout
            aside={
              <StaggerGroup className="space-y-5">
                <BrandingPreview
                  primaryColor={form.primaryColor}
                  secondaryColor={form.secondaryColor}
                  theme={form.theme}
                  welcomeMessage={form.welcomeMessage}
                  logoUrl={branding.data.logoUrl}
                  loginBackgroundUrl={branding.data.loginBackgroundUrl}
                  dashboardBannerUrl={branding.data.dashboardBannerUrl}
                  gymName={profile.data?.gymName ?? ''}
                />
              </StaggerGroup>
            }
          >
            <StaggerGroup className="space-y-5">
              <SectionCard tone="staff" icon={Palette} title="Theme colors" subtitle="Applied to the sidebar, buttons and login screen.">
                <div className="grid gap-4 sm:grid-cols-2">
                  <ColorPicker id="primaryColor" label="Primary color" value={form.primaryColor} disabled={!canManage} onChange={(value) => setForm({ ...form, primaryColor: value })} />
                  <ColorPicker id="secondaryColor" label="Secondary color" value={form.secondaryColor} disabled={!canManage} onChange={(value) => setForm({ ...form, secondaryColor: value })} />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Theme" htmlFor="theme" required>
                    <select id="theme" className={selectClassName} value={form.theme} disabled={!canManage} onChange={(e) => setForm({ ...form, theme: e.target.value as ThemePreference })}>
                      <option value="SYSTEM">Match device</option>
                      <option value="LIGHT">Light</option>
                      <option value="DARK">Dark</option>
                    </select>
                  </Field>
                  <Field label="Login welcome message" htmlFor="welcomeMessage">
                    <Input id="welcomeMessage" value={form.welcomeMessage} disabled={!canManage} onChange={(e) => setForm({ ...form, welcomeMessage: e.target.value })} />
                  </Field>
                </div>
              </SectionCard>

              <SectionCard tone="members" icon={ImageIcon} title="Images" subtitle="Uploads are resized in your browser and saved immediately.">
                <div className="divide-y divide-border [&>*+*]:pt-6 [&>*]:pb-6 [&>*:last-child]:pb-0">
                  <ImageUploadField label="Gym logo" description="Shown in the sidebar and login screen." value={branding.data.logoUrl} maxDimension={512} disabled={!canManage} onUpload={(dataUrl, onProgress) => handleUpload('logo', dataUrl, onProgress)} />
                  <ImageUploadField label="Favicon" description="Shown in the browser tab." value={branding.data.faviconUrl} maxDimension={64} previewClassName="size-10" disabled={!canManage} onUpload={(dataUrl, onProgress) => handleUpload('favicon', dataUrl, onProgress)} />
                  <ImageUploadField label="Login background image" value={branding.data.loginBackgroundUrl} maxDimension={1280} previewClassName="h-16 w-28" disabled={!canManage} onUpload={(dataUrl, onProgress) => handleUpload('loginBackgroundUrl', dataUrl, onProgress)} />
                  <ImageUploadField label="Dashboard banner" value={branding.data.dashboardBannerUrl} maxDimension={1280} previewClassName="h-16 w-28" disabled={!canManage} onUpload={(dataUrl, onProgress) => handleUpload('dashboardBannerUrl', dataUrl, onProgress)} />
                  <ImageUploadField label="Email logo" description="Used in transactional emails sent to your staff and members." value={branding.data.emailLogoUrl} maxDimension={512} disabled={!canManage} onUpload={(dataUrl, onProgress) => handleUpload('emailLogoUrl', dataUrl, onProgress)} />
                </div>
              </SectionCard>
            </StaggerGroup>
          </SettingsLayout>
        </>
      )}
    </div>
  );
}
