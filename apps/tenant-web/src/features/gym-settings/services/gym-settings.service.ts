import type { AxiosProgressEvent } from 'axios';

import { apiClient } from '@/features/auth/services/api-client';
import type {
  Branding,
  BrandingAssetField,
  BusinessHours,
  BusinessSettings,
  EmailSettings,
  GymProfile,
  InvoiceSettings,
  NotificationSettings,
  SocialLinks,
  UpdateBrandingPayload,
  UpdateBusinessSettingsPayload,
  UpdateContactInfoPayload,
  UpdateGymProfilePayload,
  UpdateInvoiceSettingsPayload,
} from '../types';

interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
}

/** Transport for the Gym Profile, Branding & Business Settings module — same apiClient as every other feature (tenant header/bearer/refresh inherited). */
class GymSettingsService {
  // ── Gym Profile ─────────────────────────────────────────────────────────
  async getProfile(): Promise<GymProfile> {
    const res = await apiClient.get<ApiEnvelope<GymProfile>>('/settings/profile');
    return res.data.data;
  }

  async updateProfile(payload: UpdateGymProfilePayload): Promise<GymProfile> {
    const res = await apiClient.patch<ApiEnvelope<GymProfile>>('/settings/profile', payload);
    return res.data.data;
  }

  async updateContactInfo(payload: UpdateContactInfoPayload): Promise<GymProfile> {
    const res = await apiClient.patch<ApiEnvelope<GymProfile>>('/settings/profile/contact', payload);
    return res.data.data;
  }

  async updateBusinessHours(businessHours: BusinessHours): Promise<GymProfile> {
    const res = await apiClient.patch<ApiEnvelope<GymProfile>>('/settings/profile/business-hours', businessHours);
    return res.data.data;
  }

  async updateSocialLinks(socialLinks: SocialLinks): Promise<GymProfile> {
    const res = await apiClient.patch<ApiEnvelope<GymProfile>>('/settings/profile/social-links', socialLinks);
    return res.data.data;
  }

  // ── Business Settings ────────────────────────────────────────────────────
  async getBusinessSettings(): Promise<BusinessSettings> {
    const res = await apiClient.get<ApiEnvelope<BusinessSettings>>('/settings/business');
    return res.data.data;
  }

  async updateBusinessSettings(payload: UpdateBusinessSettingsPayload): Promise<BusinessSettings> {
    const res = await apiClient.patch<ApiEnvelope<BusinessSettings>>('/settings/business', payload);
    return res.data.data;
  }

  // ── Branding ──────────────────────────────────────────────────────────────
  // silent: true — every upload mutation below invalidates this query on
  // success, triggering an automatic background refetch right after the
  // upload's own local progress bar completes. Without `silent`, that
  // refetch (not the upload itself, which was already fixed) was what
  // popped the global loader back up immediately after "Image uploaded"
  // (user-reported/screenshotted). The branding page already renders its
  // own `Skeleton` for the true first-load case (`branding.isPending`);
  // this refetch-after-save has no visible content gap to fill.
  async getBranding(): Promise<Branding> {
    const res = await apiClient.get<ApiEnvelope<Branding>>('/settings/branding', { silent: true });
    return res.data.data;
  }

  async updateBranding(payload: UpdateBrandingPayload): Promise<Branding> {
    const res = await apiClient.patch<ApiEnvelope<Branding>>('/settings/branding', payload);
    return res.data.data;
  }

  // `silent: true` on every upload below — these already have their own
  // local, in-place progress bar (see `ImageUploadField`); the global
  // full-screen loader showing on top of that is redundant and, worse,
  // covers the exact thumbnail/button the user is watching.
  async uploadLogo(dataUrl: string, onUploadProgress?: (event: AxiosProgressEvent) => void): Promise<Branding> {
    const res = await apiClient.post<ApiEnvelope<Branding>>('/settings/branding/logo', { dataUrl }, { silent: true, onUploadProgress });
    return res.data.data;
  }

  async uploadFavicon(dataUrl: string, onUploadProgress?: (event: AxiosProgressEvent) => void): Promise<Branding> {
    const res = await apiClient.post<ApiEnvelope<Branding>>('/settings/branding/favicon', { dataUrl }, { silent: true, onUploadProgress });
    return res.data.data;
  }

  async uploadBrandingAsset(
    field: BrandingAssetField,
    dataUrl: string,
    onUploadProgress?: (event: AxiosProgressEvent) => void,
  ): Promise<Branding> {
    const res = await apiClient.post<ApiEnvelope<Branding>>('/settings/branding/upload', { field, dataUrl }, { silent: true, onUploadProgress });
    return res.data.data;
  }

  // ── Invoice Settings ──────────────────────────────────────────────────────
  async getInvoiceSettings(): Promise<InvoiceSettings> {
    const res = await apiClient.get<ApiEnvelope<InvoiceSettings>>('/settings/invoice');
    return res.data.data;
  }

  async updateInvoiceSettings(payload: UpdateInvoiceSettingsPayload): Promise<InvoiceSettings> {
    const res = await apiClient.patch<ApiEnvelope<InvoiceSettings>>('/settings/invoice', payload);
    return res.data.data;
  }

  // ── Email Settings ──────────────────────────────────────────────────────
  async getEmailSettings(): Promise<EmailSettings> {
    const res = await apiClient.get<ApiEnvelope<EmailSettings>>('/settings/email');
    return res.data.data;
  }

  async updateEmailSettings(payload: EmailSettings): Promise<EmailSettings> {
    const res = await apiClient.patch<ApiEnvelope<EmailSettings>>('/settings/email', payload);
    return res.data.data;
  }

  // ── Notification Preferences ─────────────────────────────────────────────
  async getNotificationSettings(): Promise<NotificationSettings> {
    const res = await apiClient.get<ApiEnvelope<NotificationSettings>>('/settings/notifications');
    return res.data.data;
  }

  async updateNotificationSettings(payload: Partial<NotificationSettings>): Promise<NotificationSettings> {
    const res = await apiClient.patch<ApiEnvelope<NotificationSettings>>('/settings/notifications', payload);
    return res.data.data;
  }
}

export const gymSettingsService = new GymSettingsService();
