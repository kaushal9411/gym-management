import { Prisma } from '@prisma/client';
import type { TenantBranding, TenantInvoiceSettings, TenantProfile, TenantSettings } from '@prisma/client';

import { getTenantScopedClient } from '../../../infrastructure/database/tenant-scoped-client';
import { AuditLogRepository } from '../../authentication/repositories/audit-log.repository';
import type { IamActor } from '../../authentication/utils/actor.util';
import { tenantService } from '../../tenants/service/tenant.service';
import type {
  BrandingDto,
  BusinessSettingsDto,
  EmailSettingsDto,
  GymProfileDto,
  InvoiceSettingsDto,
  NotificationSettingsDto,
  UpdateBrandingInput,
  UpdateBusinessSettingsInput,
  UpdateContactInfoInput,
  UpdateEmailSettingsInput,
  UpdateGymProfileInput,
  UpdateInvoiceSettingsInput,
  UpdateNotificationSettingsInput,
} from '../dto/settings.dto';
import { TenantBrandingSettingsRepository } from '../repositories/tenant-branding-settings.repository';
import { TenantBusinessSettingsRepository } from '../repositories/tenant-business-settings.repository';
import { TenantInvoiceSettingsRepository } from '../repositories/tenant-invoice-settings.repository';
import { TenantProfileRepository } from '../repositories/tenant-profile.repository';

function toGymProfileDto(gymName: string, profile: TenantProfile | null): GymProfileDto {
  return {
    gymName,
    legalBusinessName: profile?.legalBusinessName ?? null,
    registrationNumber: profile?.registrationNumber ?? null,
    gstVatNumber: profile?.gstVatNumber ?? null,
    businessType: profile?.businessType ?? null,
    description: profile?.description ?? null,
    email: profile?.email ?? null,
    phone: profile?.phone ?? null,
    alternatePhone: profile?.alternatePhone ?? null,
    website: profile?.website ?? null,
    addressLine: profile?.addressLine ?? null,
    city: profile?.city ?? null,
    state: profile?.state ?? null,
    country: profile?.country ?? null,
    postalCode: profile?.postalCode ?? null,
    latitude: profile?.latitude ? Number(profile.latitude) : null,
    longitude: profile?.longitude ? Number(profile.longitude) : null,
    businessHours: (profile?.businessHours as GymProfileDto['businessHours']) ?? null,
    socialLinks: (profile?.socialLinks as GymProfileDto['socialLinks']) ?? null,
    updatedAt: (profile?.updatedAt ?? new Date()).toISOString(),
  };
}

function toBusinessSettingsDto(settings: TenantSettings): BusinessSettingsDto {
  return {
    currency: settings.currency,
    currencySymbol: settings.currencySymbol,
    timezone: settings.timezone,
    dateFormat: settings.dateFormat,
    timeFormat: settings.timeFormat,
    weekStartDay: settings.weekStartDay,
    measurementUnit: settings.measurementUnit,
    locale: settings.locale,
    updatedAt: settings.updatedAt.toISOString(),
  };
}

function toBrandingDto(branding: TenantBranding): BrandingDto {
  return {
    logoUrl: branding.logoUrl,
    faviconUrl: branding.faviconUrl,
    primaryColor: branding.primaryColor,
    secondaryColor: branding.secondaryColor,
    theme: branding.theme,
    welcomeMessage: branding.welcomeMessage,
    loginBackgroundUrl: branding.loginBackgroundUrl,
    dashboardBannerUrl: branding.dashboardBannerUrl,
    emailLogoUrl: branding.emailLogoUrl,
    updatedAt: branding.updatedAt.toISOString(),
  };
}

function toInvoiceSettingsDto(settings: TenantInvoiceSettings): InvoiceSettingsDto {
  return {
    invoicePrefix: settings.invoicePrefix,
    invoiceFooter: settings.invoiceFooter,
    taxPercentage: Number(settings.taxPercentage),
    defaultPaymentTermsDays: settings.defaultPaymentTermsDays,
    updatedAt: settings.updatedAt.toISOString(),
  };
}

function toEmailSettingsDto(settings: TenantSettings): EmailSettingsDto {
  return { emailFromName: settings.emailFromName, emailFromAddress: settings.emailFromAddress };
}

function toNotificationSettingsDto(settings: TenantSettings): NotificationSettingsDto {
  return {
    emailNotificationsEnabled: settings.emailNotificationsEnabled,
    pushNotificationsEnabled: settings.pushNotificationsEnabled,
    smsNotificationsEnabled: settings.smsNotificationsEnabled,
    smsProviderConfig: (settings.smsProviderConfig as Record<string, unknown> | null) ?? null,
  };
}

/**
 * Gym Profile, Branding & Business Settings (Prompt 12). Every write here
 * either touches `TenantSettings`/`TenantBranding` (both feed the cached
 * `ResolvedTenant` every request reads via tenantMiddleware) or the tenant
 * row itself (gym name) — so every mutating method invalidates the tenant
 * cache the same way subscription/onboarding already do, and every write
 * is audited exactly like the IAM module's convention.
 */
export class SettingsService {
  private readonly profileRepository: TenantProfileRepository;
  private readonly businessRepository: TenantBusinessSettingsRepository;
  private readonly brandingRepository: TenantBrandingSettingsRepository;
  private readonly invoiceRepository: TenantInvoiceSettingsRepository;
  private readonly auditLog: AuditLogRepository;
  private readonly db: ReturnType<typeof getTenantScopedClient>;

  constructor(
    private readonly tenantId: string,
    private readonly tenantSlug: string,
  ) {
    this.db = getTenantScopedClient(tenantId);
    this.profileRepository = new TenantProfileRepository(this.db);
    this.businessRepository = new TenantBusinessSettingsRepository(this.db);
    this.brandingRepository = new TenantBrandingSettingsRepository(this.db);
    this.invoiceRepository = new TenantInvoiceSettingsRepository(this.db);
    this.auditLog = new AuditLogRepository(this.db);
  }

  // ── Gym Profile ───────────────────────────────────────────────────────

  async getProfile(): Promise<GymProfileDto> {
    const [tenant, profile] = await Promise.all([
      this.db.tenant.findFirstOrThrow({ where: { id: this.tenantId } }),
      this.profileRepository.find(this.tenantId),
    ]);
    return toGymProfileDto(tenant.name, profile);
  }

  async updateProfile(input: UpdateGymProfileInput, actor: IamActor): Promise<GymProfileDto> {
    if (input.gymName) {
      await this.db.tenant.update({ where: { id: this.tenantId }, data: { name: input.gymName } });
      await this.invalidateTenantCache();
    }
    await this.profileRepository.upsert(this.tenantId, {
      legalBusinessName: input.legalBusinessName,
      registrationNumber: input.registrationNumber,
      gstVatNumber: input.gstVatNumber,
      businessType: input.businessType,
      description: input.description,
    });
    await this.audit(actor, 'settings.profile_updated');
    return this.getProfile();
  }

  async updateContactInfo(input: UpdateContactInfoInput, actor: IamActor): Promise<GymProfileDto> {
    await this.profileRepository.upsert(this.tenantId, input);
    await this.audit(actor, 'settings.contact_info_updated');
    return this.getProfile();
  }

  async updateBusinessHours(businessHours: GymProfileDto['businessHours'], actor: IamActor): Promise<GymProfileDto> {
    await this.profileRepository.upsert(this.tenantId, {
      businessHours: (businessHours ?? undefined) as Prisma.InputJsonValue | undefined,
    });
    await this.audit(actor, 'settings.business_hours_updated');
    return this.getProfile();
  }

  async updateSocialLinks(socialLinks: GymProfileDto['socialLinks'], actor: IamActor): Promise<GymProfileDto> {
    await this.profileRepository.upsert(this.tenantId, {
      socialLinks: (socialLinks ?? undefined) as Prisma.InputJsonValue | undefined,
    });
    await this.audit(actor, 'settings.social_links_updated');
    return this.getProfile();
  }

  // ── Business Settings ────────────────────────────────────────────────

  async getBusinessSettings(): Promise<BusinessSettingsDto> {
    return toBusinessSettingsDto(await this.mustFindBusinessSettings());
  }

  async updateBusinessSettings(input: UpdateBusinessSettingsInput, actor: IamActor): Promise<BusinessSettingsDto> {
    const updated = await this.businessRepository.update(this.tenantId, input);
    await this.invalidateTenantCache();
    await this.audit(actor, 'settings.business_settings_updated');
    return toBusinessSettingsDto(updated);
  }

  // ── Branding ──────────────────────────────────────────────────────────

  async getBranding(): Promise<BrandingDto> {
    return toBrandingDto(await this.mustFindBranding());
  }

  async updateBranding(input: UpdateBrandingInput, actor: IamActor): Promise<BrandingDto> {
    const updated = await this.brandingRepository.update(this.tenantId, input);
    await this.invalidateTenantCache();
    await this.audit(actor, 'settings.branding_updated');
    return toBrandingDto(updated);
  }

  async uploadLogo(dataUrl: string, actor: IamActor): Promise<BrandingDto> {
    return this.uploadBrandingImage('logoUrl', dataUrl, actor, 'settings.logo_uploaded');
  }

  async uploadFavicon(dataUrl: string, actor: IamActor): Promise<BrandingDto> {
    return this.uploadBrandingImage('faviconUrl', dataUrl, actor, 'settings.favicon_uploaded');
  }

  async uploadBrandingAsset(
    field: 'loginBackgroundUrl' | 'dashboardBannerUrl' | 'emailLogoUrl',
    dataUrl: string,
    actor: IamActor,
  ): Promise<BrandingDto> {
    return this.uploadBrandingImage(field, dataUrl, actor, 'settings.branding_asset_uploaded');
  }

  private async uploadBrandingImage(
    field: 'logoUrl' | 'faviconUrl' | 'loginBackgroundUrl' | 'dashboardBannerUrl' | 'emailLogoUrl',
    dataUrl: string,
    actor: IamActor,
    action: string,
  ): Promise<BrandingDto> {
    const updated = await this.brandingRepository.update(this.tenantId, { [field]: dataUrl });
    await this.invalidateTenantCache();
    await this.audit(actor, action, field);
    return toBrandingDto(updated);
  }

  // ── Invoice Settings ──────────────────────────────────────────────────

  async getInvoiceSettings(): Promise<InvoiceSettingsDto> {
    return toInvoiceSettingsDto(await this.mustFindInvoiceSettings());
  }

  async updateInvoiceSettings(input: UpdateInvoiceSettingsInput, actor: IamActor): Promise<InvoiceSettingsDto> {
    const updated = await this.invoiceRepository.update(this.tenantId, input);
    await this.audit(actor, 'settings.invoice_settings_updated');
    return toInvoiceSettingsDto(updated);
  }

  // ── Email Settings ────────────────────────────────────────────────────

  async getEmailSettings(): Promise<EmailSettingsDto> {
    return toEmailSettingsDto(await this.mustFindBusinessSettings());
  }

  async updateEmailSettings(input: UpdateEmailSettingsInput, actor: IamActor): Promise<EmailSettingsDto> {
    const updated = await this.businessRepository.update(this.tenantId, input);
    await this.audit(actor, 'settings.email_settings_updated');
    return toEmailSettingsDto(updated);
  }

  // ── Notification Preferences ─────────────────────────────────────────

  async getNotificationSettings(): Promise<NotificationSettingsDto> {
    return toNotificationSettingsDto(await this.mustFindBusinessSettings());
  }

  async updateNotificationSettings(
    input: UpdateNotificationSettingsInput,
    actor: IamActor,
  ): Promise<NotificationSettingsDto> {
    const { smsProviderConfig, ...rest } = input;
    const updated = await this.businessRepository.update(this.tenantId, {
      ...rest,
      ...(smsProviderConfig !== undefined && {
        smsProviderConfig: smsProviderConfig === null ? Prisma.JsonNull : (smsProviderConfig as Prisma.InputJsonValue),
      }),
    });
    await this.audit(actor, 'settings.notification_settings_updated');
    return toNotificationSettingsDto(updated);
  }

  // ── internals ─────────────────────────────────────────────────────────

  private async mustFindBusinessSettings(): Promise<TenantSettings> {
    const existing = await this.businessRepository.find(this.tenantId);
    return existing ?? this.businessRepository.update(this.tenantId, {});
  }

  private async mustFindBranding(): Promise<TenantBranding> {
    const existing = await this.brandingRepository.find(this.tenantId);
    return existing ?? this.brandingRepository.update(this.tenantId, {});
  }

  private async mustFindInvoiceSettings(): Promise<TenantInvoiceSettings> {
    const existing = await this.invoiceRepository.find(this.tenantId);
    return existing ?? this.invoiceRepository.update(this.tenantId, {});
  }

  private async invalidateTenantCache(): Promise<void> {
    await tenantService.invalidateCache(this.tenantSlug, this.tenantId);
  }

  private async audit(actor: IamActor, action: string, entityId?: string): Promise<void> {
    await this.auditLog.record({
      tenantId: this.tenantId,
      actorUserId: actor.userId,
      actorRole: actor.role,
      action,
      entityType: 'settings',
      entityId,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });
  }
}
