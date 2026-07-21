export interface BusinessHoursDay {
  open: string | null;
  close: string | null;
  closed: boolean;
}

export type Weekday = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

export type BusinessHours = Partial<Record<Weekday, BusinessHoursDay>>;

export interface SocialLinks {
  facebook?: string;
  instagram?: string;
  twitter?: string;
  youtube?: string;
  linkedin?: string;
}

export interface GymProfile {
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

export interface UpdateGymProfilePayload {
  gymName?: string;
  legalBusinessName?: string | null;
  registrationNumber?: string | null;
  gstVatNumber?: string | null;
  businessType?: string | null;
  description?: string | null;
}

export interface UpdateContactInfoPayload {
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

export type MeasurementUnit = 'METRIC' | 'IMPERIAL';

export interface BusinessSettings {
  currency: string;
  currencySymbol: string;
  timezone: string;
  dateFormat: string;
  timeFormat: string;
  weekStartDay: number;
  measurementUnit: MeasurementUnit;
  locale: string;
  updatedAt: string;
}

export type UpdateBusinessSettingsPayload = Partial<Omit<BusinessSettings, 'updatedAt'>>;

export type ThemePreference = 'LIGHT' | 'DARK' | 'SYSTEM';

export interface Branding {
  logoUrl: string | null;
  faviconUrl: string | null;
  primaryColor: string;
  secondaryColor: string | null;
  theme: ThemePreference;
  welcomeMessage: string | null;
  loginBackgroundUrl: string | null;
  dashboardBannerUrl: string | null;
  emailLogoUrl: string | null;
  updatedAt: string;
}

export interface UpdateBrandingPayload {
  primaryColor?: string;
  secondaryColor?: string;
  theme?: ThemePreference;
  welcomeMessage?: string;
}

export type BrandingAssetField = 'loginBackgroundUrl' | 'dashboardBannerUrl' | 'emailLogoUrl';

export interface InvoiceSettings {
  invoicePrefix: string;
  invoiceFooter: string | null;
  taxPercentage: number;
  defaultPaymentTermsDays: number;
  updatedAt: string;
}

export type UpdateInvoiceSettingsPayload = Partial<Omit<InvoiceSettings, 'updatedAt'>>;

export interface EmailSettings {
  emailFromName: string | null;
  emailFromAddress: string | null;
}

export interface NotificationSettings {
  emailNotificationsEnabled: boolean;
  pushNotificationsEnabled: boolean;
  smsNotificationsEnabled: boolean;
  smsProviderConfig: Record<string, unknown> | null;
}
