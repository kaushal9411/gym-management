'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { ColorPicker } from '@/features/gym-settings/components/color-picker';
import { GymSettingsNav } from '@/features/gym-settings/components/gym-settings-nav';
import { ImageUploadField } from '@/features/gym-settings/components/image-upload-field';
import { UnsavedChangesBar } from '@/features/gym-settings/components/unsaved-changes-bar';
import {
  toGymSettingsError,
  useBranding,
  useUpdateBranding,
  useUploadBrandingAsset,
  useUploadFavicon,
  useUploadLogo,
} from '@/features/gym-settings/hooks/use-gym-settings';
import type { ThemePreference } from '@/features/gym-settings/types';
import { cn } from '@/lib/utils';

const selectClassName = cn(
  'h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
);

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

  const handleUpload = async (kind: 'logo' | 'favicon' | 'loginBackgroundUrl' | 'dashboardBannerUrl' | 'emailLogoUrl', dataUrl: string) => {
    try {
      if (kind === 'logo') await uploadLogo.mutateAsync(dataUrl);
      else if (kind === 'favicon') await uploadFavicon.mutateAsync(dataUrl);
      else await uploadAsset.mutateAsync({ field: kind, dataUrl });
      toast.success('Image uploaded');
      refreshPortalChrome();
    } catch (error) {
      toast.error(toGymSettingsError(error).message);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Branding</h1>
        <p className="text-muted-foreground">Your gym&apos;s colors, logo, and images across the portal, login, and emails.</p>
      </div>

      <GymSettingsNav />

      {branding.isPending || !form ? (
        <div className="space-y-4">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : branding.isError ? (
        <p className="text-sm text-destructive">Couldn&apos;t load branding — try refreshing.</p>
      ) : (
        <>
          {canManage ? (
            <UnsavedChangesBar isDirty={isDirty} saving={updateBranding.isPending} onSave={() => void handleSave()} onCancel={handleCancel} />
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Theme colors</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <ColorPicker
                  id="primaryColor"
                  label="Primary color"
                  value={form.primaryColor}
                  disabled={!canManage}
                  onChange={(value) => setForm({ ...form, primaryColor: value })}
                />
                <ColorPicker
                  id="secondaryColor"
                  label="Secondary color"
                  value={form.secondaryColor}
                  disabled={!canManage}
                  onChange={(value) => setForm({ ...form, secondaryColor: value })}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="theme">Theme</Label>
                  <select
                    id="theme"
                    className={selectClassName}
                    value={form.theme}
                    disabled={!canManage}
                    onChange={(e) => setForm({ ...form, theme: e.target.value as ThemePreference })}
                  >
                    <option value="SYSTEM">Match device</option>
                    <option value="LIGHT">Light</option>
                    <option value="DARK">Dark</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="welcomeMessage">Login welcome message</Label>
                  <Input
                    id="welcomeMessage"
                    value={form.welcomeMessage}
                    disabled={!canManage}
                    onChange={(e) => setForm({ ...form, welcomeMessage: e.target.value })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Images</CardTitle>
              <CardDescription>Uploads are resized in your browser and saved immediately.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <ImageUploadField
                label="Gym logo"
                description="Shown in the sidebar and login screen."
                value={branding.data.logoUrl}
                maxDimension={512}
                disabled={!canManage}
                onUpload={(dataUrl) => void handleUpload('logo', dataUrl)}
              />
              <ImageUploadField
                label="Favicon"
                description="Shown in the browser tab."
                value={branding.data.faviconUrl}
                maxDimension={64}
                previewClassName="size-10"
                disabled={!canManage}
                onUpload={(dataUrl) => void handleUpload('favicon', dataUrl)}
              />
              <ImageUploadField
                label="Login background image"
                value={branding.data.loginBackgroundUrl}
                maxDimension={1280}
                previewClassName="h-16 w-28"
                disabled={!canManage}
                onUpload={(dataUrl) => void handleUpload('loginBackgroundUrl', dataUrl)}
              />
              <ImageUploadField
                label="Dashboard banner"
                value={branding.data.dashboardBannerUrl}
                maxDimension={1280}
                previewClassName="h-16 w-28"
                disabled={!canManage}
                onUpload={(dataUrl) => void handleUpload('dashboardBannerUrl', dataUrl)}
              />
              <ImageUploadField
                label="Email logo"
                description="Used in transactional emails sent to your staff and members."
                value={branding.data.emailLogoUrl}
                maxDimension={512}
                disabled={!canManage}
                onUpload={(dataUrl) => void handleUpload('emailLogoUrl', dataUrl)}
              />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
