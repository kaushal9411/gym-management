/** Tenant branding as delivered by the (future) public resolve endpoint. */
export interface TenantBranding {
  /** Primary brand color as an oklch()/hex CSS color — drives --primary/--ring. */
  primaryColor: string;
  /** Readable foreground on the primary color. */
  primaryForeground: string;
  /** Optional hosted logo; when absent the initials mark is rendered. */
  logoUrl?: string;
  /** Short welcome line shown on the login screen. */
  welcomeMessage: string;
}

export type TenantStatus = 'trial' | 'active' | 'past_due' | 'suspended' | 'cancelled';

export interface Tenant {
  id: string;
  slug: string;
  name: string;
  status: TenantStatus;
  branding: TenantBranding;
}

/** The platform itself, used on non-tenant hosts (localhost, fitcloud.com). */
export const PLATFORM_TENANT: Tenant = {
  id: 'platform',
  slug: '',
  name: 'FitCloud',
  status: 'active',
  branding: {
    primaryColor: 'oklch(0.51 0.23 277)',
    primaryForeground: 'oklch(0.985 0 0)',
    welcomeMessage: 'The operating system for modern gyms.',
  },
};
