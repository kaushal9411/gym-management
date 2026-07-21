export interface BusinessHoursDay {
  open: string | null;
  close: string | null;
  closed: boolean;
}

export type BusinessHours = Partial<
  Record<'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday', BusinessHoursDay>
>;

export interface SocialLinks {
  facebook?: string;
  instagram?: string;
  twitter?: string;
  youtube?: string;
  linkedin?: string;
}

export interface GymProfileDto {
  gymName: string;
  legalBusinessName: string | null;
  registrationNumber: string | null;
  gstVatNumber: string | null;
  businessType: string | null;
  description: string | null;
  email: string | null;
  phone: string | null;
  alternatePhone: string | null;
  website: string | null;
  addressLine: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  postalCode: string | null;
  latitude: number | null;
  longitude: number | null;
  businessHours: BusinessHours | null;
  socialLinks: SocialLinks | null;
  updatedAt: string;
}

export interface UpdateGymProfileInput {
  gymName?: string;
  legalBusinessName?: string | null;
  registrationNumber?: string | null;
  gstVatNumber?: string | null;
  businessType?: string | null;
  description?: string | null;
}

export interface UpdateContactInfoInput {
  email?: string | null;
  phone?: string | null;
  alternatePhone?: string | null;
  website?: string | null;
  addressLine?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  postalCode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

export interface BusinessSettingsDto {
  currency: string;
  currencySymbol: string;
  timezone: string;
  dateFormat: string;
  timeFormat: string;
  weekStartDay: number;
  measurementUnit: 'METRIC' | 'IMPERIAL';
  locale: string;
  updatedAt: string;
}

export interface UpdateBusinessSettingsInput {
  currency?: string;
  currencySymbol?: string;
  timezone?: string;
  dateFormat?: string;
  timeFormat?: string;
  weekStartDay?: number;
  measurementUnit?: 'METRIC' | 'IMPERIAL';
  locale?: string;
}

export interface BrandingDto {
  logoUrl: string | null;
  faviconUrl: string | null;
  primaryColor: string;
  secondaryColor: string | null;
  theme: 'LIGHT' | 'DARK' | 'SYSTEM';
  welcomeMessage: string | null;
  loginBackgroundUrl: string | null;
  dashboardBannerUrl: string | null;
  emailLogoUrl: string | null;
  updatedAt: string;
}

export interface UpdateBrandingInput {
  primaryColor?: string;
  secondaryColor?: string;
  theme?: 'LIGHT' | 'DARK' | 'SYSTEM';
  welcomeMessage?: string;
}

export interface InvoiceSettingsDto {
  invoicePrefix: string;
  invoiceFooter: string | null;
  taxPercentage: number;
  defaultPaymentTermsDays: number;
  updatedAt: string;
}

export interface UpdateInvoiceSettingsInput {
  invoicePrefix?: string;
  invoiceFooter?: string | null;
  taxPercentage?: number;
  defaultPaymentTermsDays?: number;
}

export interface EmailSettingsDto {
  emailFromName: string | null;
  emailFromAddress: string | null;
}

export interface UpdateEmailSettingsInput {
  emailFromName?: string | null;
  emailFromAddress?: string | null;
}

export interface NotificationSettingsDto {
  emailNotificationsEnabled: boolean;
  pushNotificationsEnabled: boolean;
  smsNotificationsEnabled: boolean;
  smsProviderConfig: Record<string, unknown> | null;
}

export interface UpdateNotificationSettingsInput {
  emailNotificationsEnabled?: boolean;
  pushNotificationsEnabled?: boolean;
  smsNotificationsEnabled?: boolean;
  smsProviderConfig?: Record<string, unknown> | null;
}
