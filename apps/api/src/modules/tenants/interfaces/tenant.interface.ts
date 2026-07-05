import type { TenantStatus } from '@prisma/client';

/**
 * What the rest of the app is allowed to know about the resolved tenant —
 * extended in Prompt 10 with everything the portal shell's "Load Branding"
 * / "Load Feature Flags" / "Load Current Branch" initialization steps need,
 * so tenant-web can do all of it from ONE resolve call instead of five.
 */
export interface ResolvedTenant {
  id: string;
  slug: string;
  name: string;
  status: TenantStatus;
  maintenanceMode: boolean;
  branding: {
    primaryColor: string;
    primaryForeground: string;
    secondaryColor: string;
    logoUrl?: string;
    faviconUrl?: string;
    welcomeMessage: string;
  };
  timezone: string;
  currency: string;
  locale: string;
  emailFromName: string | null;
  emailFromAddress: string | null;
  subscription: {
    status: string;
    planSlug: string;
    planName: string;
    trialEndsAt: string | null;
    currentPeriodEnd: string | null;
  } | null;
  /** Enabled module keys only — a plain string[] is all the frontend's feature-flag guard needs. */
  featureFlags: string[];
  defaultBranch: { id: string; name: string; timezone: string } | null;
}

export interface TenantRepositoryPort {
  findBySlug(slug: string): Promise<ResolvedTenantRecord | null>;
  findById(tenantId: string): Promise<ResolvedTenantRecord | null>;
  slugExists(slug: string): Promise<boolean>;
  createTenantWithSettings(input: CreateTenantInput): Promise<ResolvedTenantRecord>;
}

export interface ResolvedTenantRecord {
  id: string;
  slug: string;
  name: string;
  status: TenantStatus;
  trialEndsAt: Date | null;
  subscriptionExpiresAt: Date | null;
  maintenanceMode: boolean;
  settings: {
    branding: Record<string, unknown>;
    timezone: string;
    currency: string;
    locale: string;
    emailFromName: string | null;
    emailFromAddress: string | null;
  } | null;
  branding: {
    primaryColor: string;
    primaryForeground: string;
    secondaryColor: string | null;
    logoUrl: string | null;
    faviconUrl: string | null;
    welcomeMessage: string | null;
  } | null;
  subscriptions: Array<{
    status: string;
    trialEndsAt: Date | null;
    currentPeriodEnd: Date | null;
    plan: { slug: string; name: string };
  }>;
  modules: Array<{ key: string; enabled: boolean }>;
  branches: Array<{ id: string; name: string; timezone: string }>;
}

export interface CreateTenantInput {
  slug: string;
  name: string;
  trialDays: number;
}
