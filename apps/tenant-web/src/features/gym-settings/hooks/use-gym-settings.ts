'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { AuthServiceError } from '@/features/auth/types';
import { gymSettingsService } from '../services/gym-settings.service';
import type {
  BrandingAssetField,
  BusinessHours,
  NotificationSettings,
  SocialLinks,
  UpdateBrandingPayload,
  UpdateBusinessSettingsPayload,
  UpdateContactInfoPayload,
  UpdateGymProfilePayload,
  UpdateInvoiceSettingsPayload,
} from '../types';

export function toGymSettingsError(error: unknown): AuthServiceError {
  if (error instanceof AuthServiceError) return error;
  return new AuthServiceError('UNKNOWN', 'Something went wrong. Please try again.');
}

// ── Gym Profile ─────────────────────────────────────────────────────────

export function useGymProfile() {
  return useQuery({ queryKey: ['gym-settings', 'profile'], queryFn: () => gymSettingsService.getProfile() });
}

function useInvalidateProfile() {
  const queryClient = useQueryClient();
  return () => void queryClient.invalidateQueries({ queryKey: ['gym-settings', 'profile'] });
}

export function useUpdateGymProfile() {
  const invalidate = useInvalidateProfile();
  return useMutation({
    mutationFn: (payload: UpdateGymProfilePayload) => gymSettingsService.updateProfile(payload),
    onSuccess: invalidate,
  });
}

export function useUpdateContactInfo() {
  const invalidate = useInvalidateProfile();
  return useMutation({
    mutationFn: (payload: UpdateContactInfoPayload) => gymSettingsService.updateContactInfo(payload),
    onSuccess: invalidate,
  });
}

export function useUpdateBusinessHours() {
  const invalidate = useInvalidateProfile();
  return useMutation({
    mutationFn: (businessHours: BusinessHours) => gymSettingsService.updateBusinessHours(businessHours),
    onSuccess: invalidate,
  });
}

export function useUpdateSocialLinks() {
  const invalidate = useInvalidateProfile();
  return useMutation({
    mutationFn: (socialLinks: SocialLinks) => gymSettingsService.updateSocialLinks(socialLinks),
    onSuccess: invalidate,
  });
}

// ── Business Settings ─────────────────────────────────────────────────────

export function useBusinessSettings() {
  return useQuery({ queryKey: ['gym-settings', 'business'], queryFn: () => gymSettingsService.getBusinessSettings() });
}

export function useUpdateBusinessSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateBusinessSettingsPayload) => gymSettingsService.updateBusinessSettings(payload),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['gym-settings', 'business'] }),
  });
}

// ── Branding ───────────────────────────────────────────────────────────────

export function useBranding() {
  return useQuery({ queryKey: ['gym-settings', 'branding'], queryFn: () => gymSettingsService.getBranding() });
}

function useInvalidateBranding() {
  const queryClient = useQueryClient();
  return () => void queryClient.invalidateQueries({ queryKey: ['gym-settings', 'branding'] });
}

export function useUpdateBranding() {
  const invalidate = useInvalidateBranding();
  return useMutation({
    mutationFn: (payload: UpdateBrandingPayload) => gymSettingsService.updateBranding(payload),
    onSuccess: invalidate,
  });
}

export function useUploadLogo() {
  const invalidate = useInvalidateBranding();
  return useMutation({ mutationFn: (dataUrl: string) => gymSettingsService.uploadLogo(dataUrl), onSuccess: invalidate });
}

export function useUploadFavicon() {
  const invalidate = useInvalidateBranding();
  return useMutation({
    mutationFn: (dataUrl: string) => gymSettingsService.uploadFavicon(dataUrl),
    onSuccess: invalidate,
  });
}

export function useUploadBrandingAsset() {
  const invalidate = useInvalidateBranding();
  return useMutation({
    mutationFn: ({ field, dataUrl }: { field: BrandingAssetField; dataUrl: string }) =>
      gymSettingsService.uploadBrandingAsset(field, dataUrl),
    onSuccess: invalidate,
  });
}

// ── Invoice Settings ───────────────────────────────────────────────────────

export function useInvoiceSettings() {
  return useQuery({ queryKey: ['gym-settings', 'invoice'], queryFn: () => gymSettingsService.getInvoiceSettings() });
}

export function useUpdateInvoiceSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateInvoiceSettingsPayload) => gymSettingsService.updateInvoiceSettings(payload),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['gym-settings', 'invoice'] }),
  });
}

// ── Email Settings ─────────────────────────────────────────────────────────

export function useEmailSettings() {
  return useQuery({ queryKey: ['gym-settings', 'email'], queryFn: () => gymSettingsService.getEmailSettings() });
}

export function useUpdateEmailSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { emailFromName: string | null; emailFromAddress: string | null }) =>
      gymSettingsService.updateEmailSettings(payload),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['gym-settings', 'email'] }),
  });
}

// ── Notification Preferences ──────────────────────────────────────────────

export function useTenantNotificationSettings() {
  return useQuery({
    queryKey: ['gym-settings', 'notifications'],
    queryFn: () => gymSettingsService.getNotificationSettings(),
  });
}

export function useUpdateTenantNotificationSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<NotificationSettings>) => gymSettingsService.updateNotificationSettings(payload),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['gym-settings', 'notifications'] }),
  });
}
