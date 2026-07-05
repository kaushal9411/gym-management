/** Mirrors apps/api's `AuthErrorCode` catalog for the subset onboarding calls can surface. */
export type OnboardingErrorCode =
  | 'VALIDATION_ERROR'
  | 'CONFLICT'
  | 'EMAIL_NOT_VERIFIED'
  | 'OTP_INVALID'
  | 'OTP_EXPIRED'
  | 'SLUG_TAKEN'
  | 'RATE_LIMITED'
  | 'UNKNOWN';

/** Typed service error — thrown by the onboarding service, mapped to UX by wizard steps. */
export class OnboardingServiceError extends Error {
  constructor(
    public readonly code: OnboardingErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'OnboardingServiceError';
  }
}

/**
 * Order matches the backend's actual `OnboardingStep` gating (see
 * apps/api's onboarding.service.ts#selectPlan, which asserts
 * `email_verified` before a plan can be chosen) — OTP verification comes
 * right after account details, ahead of plan selection, even though a
 * literal reading of "form → plan → subdomain → OTP → payment" would put
 * it later. Subdomain choice has no server-side step gate (it's only
 * validated for real at the final create-tenant call), so it's placed
 * wherever it reads best in the UI rather than by a backend constraint.
 */
export type WizardStep = 'account' | 'otp' | 'plan' | 'subdomain' | 'payment' | 'success';

export const WIZARD_STEPS: WizardStep[] = ['account', 'otp', 'plan', 'subdomain', 'payment', 'success'];

// ── Payloads ────────────────────────────────────────────────────────────

export interface RegisterOnboardingPayload {
  gymName: string;
  legalName?: string;
  ownerFirstName: string;
  ownerLastName: string;
  email: string;
  mobile: string;
  country: string;
  state: string;
  city: string;
  timezone: string;
  currency: string;
  gstNumber?: string;
  businessRegistrationNumber?: string;
  numberOfBranches?: number;
  expectedMembers?: number;
  password: string;
  confirmPassword: string;
  acceptTerms: boolean;
  acceptPrivacyPolicy: boolean;
  captchaToken: string;
}

export type BillingCycle = 'MONTHLY' | 'YEARLY';
export type PaymentProvider = 'stripe' | 'razorpay' | 'paypal';

// ── Results / read models ───────────────────────────────────────────────

export interface PlanFeature {
  key: string;
  label: string;
  included: boolean;
}

export interface PlanLimits {
  maxBranches: number;
  maxManagers: number;
  maxTrainers: number;
  maxMembers: number;
  maxStorageMb: number;
}

export interface SubscriptionPlan {
  slug: string;
  name: string;
  description: string;
  priceMonthly: number;
  priceYearly: number;
  currency: string;
  trialDays: number;
  limits: PlanLimits;
  features: PlanFeature[];
}

export interface SubdomainCheckResult {
  slug: string;
  available: boolean;
  reason?: string;
  suggestions: string[];
}

export interface ProvisioningResult {
  tenantId: string;
  slug: string;
  portalUrl: string;
  userId: string;
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
}

export interface OnboardingStatus {
  step: string;
  emailVerified: boolean;
  planSlug: string | null;
  provisionedSlug: string | null;
}

/**
 * Everything the wizard needs to remember across steps, persisted to
 * sessionStorage (see store/onboarding-wizard-context.tsx) — the backend's
 * Redis session is the source of truth for the actual data; this is just
 * enough for the browser to resume the right screen after a refresh.
 */
export interface WizardState {
  step: WizardStep;
  sessionId: string | null;
  maskedEmail: string | null;
  gymName: string | null;
  planSlug: string | null;
  billingCycle: BillingCycle | null;
  selectedPlan: SubscriptionPlan | null;
  subdomain: string | null;
}
