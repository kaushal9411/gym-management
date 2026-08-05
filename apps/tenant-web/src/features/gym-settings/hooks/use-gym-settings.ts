'use client';

import type { AxiosProgressEvent } from 'axios';
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
  UpdateSecuritySettingsPayload,
} from '../types';

export function toGymSettingsError(error: unknown): AuthServiceError {
  if (error instanceof AuthServiceError) return error;
  return new AuthServiceError('UNKNOWN', 'Something went wrong. Please try again.');
}

// ── Gym Profile ─────────────────────────────────────────────────────────

// Settings change rarely relative to how often they're read (every portal
// load resolves branding/business settings) — a 5-minute staleTime
// (Prompt 23: Global Loading & Performance Optimization) across every
// settings query below; each mutation's existing `invalidateQueries` call
// still forces an immediate refetch after a real change.
const SETTINGS_STALE_TIME_MS = 5 * 60_000;

export function useGymProfile() {
  return useQuery({ queryKey: ['gym-settings', 'profile'], queryFn: () => gymSettingsService.getProfile(), staleTime: SETTINGS_STALE_TIME_MS });
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
  return useQuery({ queryKey: ['gym-settings', 'business'], queryFn: () => gymSettingsService.getBusinessSettings(), staleTime: SETTINGS_STALE_TIME_MS });
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
  return useQuery({ queryKey: ['gym-settings', 'branding'], queryFn: () => gymSettingsService.getBranding(), staleTime: SETTINGS_STALE_TIME_MS });
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
  return useMutation({
    mutationFn: ({ dataUrl, onUploadProgress }: { dataUrl: string; onUploadProgress?: (event: AxiosProgressEvent) => void }) =>
      gymSettingsService.uploadLogo(dataUrl, onUploadProgress),
    onSuccess: invalidate,
  });
}

export function useUploadFavicon() {
  const invalidate = useInvalidateBranding();
  return useMutation({
    mutationFn: ({ dataUrl, onUploadProgress }: { dataUrl: string; onUploadProgress?: (event: AxiosProgressEvent) => void }) =>
      gymSettingsService.uploadFavicon(dataUrl, onUploadProgress),
    onSuccess: invalidate,
  });
}

export function useUploadBrandingAsset() {
  const invalidate = useInvalidateBranding();
  return useMutation({
    mutationFn: ({
      field,
      dataUrl,
      onUploadProgress,
    }: {
      field: BrandingAssetField;
      dataUrl: string;
      onUploadProgress?: (event: AxiosProgressEvent) => void;
    }) => gymSettingsService.uploadBrandingAsset(field, dataUrl, onUploadProgress),
    onSuccess: invalidate,
  });
}

// ── Invoice Settings ───────────────────────────────────────────────────────

export function useInvoiceSettings() {
  return useQuery({ queryKey: ['gym-settings', 'invoice'], queryFn: () => gymSettingsService.getInvoiceSettings(), staleTime: SETTINGS_STALE_TIME_MS });
}

export function useUpdateInvoiceSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateInvoiceSettingsPayload) => gymSettingsService.updateInvoiceSettings(payload),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['gym-settings', 'invoice'] }),
  });
}

// ── Security Settings ────────────────────────────────────────────────────

export function useSecuritySettings() {
  return useQuery({ queryKey: ['gym-settings', 'security'], queryFn: () => gymSettingsService.getSecuritySettings(), staleTime: SETTINGS_STALE_TIME_MS });
}

export function useUpdateSecuritySettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateSecuritySettingsPayload) => gymSettingsService.updateSecuritySettings(payload),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['gym-settings', 'security'] }),
  });
}

// ── Email Settings ─────────────────────────────────────────────────────────

export function useEmailSettings() {
  return useQuery({ queryKey: ['gym-settings', 'email'], queryFn: () => gymSettingsService.getEmailSettings(), staleTime: SETTINGS_STALE_TIME_MS });
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
    staleTime: SETTINGS_STALE_TIME_MS,
  });
}

export function useUpdateTenantNotificationSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<NotificationSettings>) => gymSettingsService.updateNotificationSettings(payload),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['gym-settings', 'notifications'] }),
  });
}
