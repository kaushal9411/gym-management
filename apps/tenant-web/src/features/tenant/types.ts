/** Tenant branding as delivered by the public resolve endpoint. */
export interface TenantBranding {
  /** Primary brand color as an oklch()/hex CSS color — drives --primary/--ring. */
  primaryColor: string;
  /** Readable foreground on the primary color. */
  primaryForeground: string;
  /** Accent color for secondary actions/badges. */
  secondaryColor: string;
  /** Optional hosted logo; when absent the initials mark is rendered. */
  logoUrl?: string;
  faviconUrl?: string;
  /** Short welcome line shown on the login screen. */
  welcomeMessage: string;
}

/** Matches the backend's TenantStatus enum verbatim — no translation layer to keep in sync. */
export type TenantStatus = 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'SUSPENDED' | 'CANCELLED';

export interface TenantSubscriptionSummary {
  status: string;
  planSlug: string;
  planName: string;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
}

export interface TenantBranch {
  id: string;
  name: string;
  timezone: string;
}

export interface Tenant {
  id: string;
  slug: string;
  name: string;
  status: TenantStatus;
  maintenanceMode: boolean;
  branding: TenantBranding;
  timezone: string;
  currency: string;
  locale: string;
  subscription: TenantSubscriptionSummary | null;
  /** Enabled module keys — the source of truth for the sidebar's feature-flag filtering. */
  featureFlags: string[];
  defaultBranch: TenantBranch | null;
}

/** The platform itself, used on non-tenant hosts (localhost, fitcloud.com) or when resolution fails. */
export const PLATFORM_TENANT: Tenant = {
  id: 'platform',
  slug: '',
  name: 'FitCloud',
  status: 'ACTIVE',
  maintenanceMode: false,
  branding: {
    primaryColor: 'oklch(0.51 0.23 277)',
    primaryForeground: 'oklch(0.985 0 0)',
    secondaryColor: 'oklch(0.62 0.2 277)',
    welcomeMessage: 'The operating system for modern gyms.',
  },
  timezone: 'UTC',
  currency: 'USD',
  locale: 'en',
  subscription: null,
  featureFlags: [],
  defaultBranch: null,
};
