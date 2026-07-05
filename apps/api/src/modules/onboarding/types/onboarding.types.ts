export type OnboardingStep =
  | 'registered'
  | 'otp_sent'
  | 'email_verified'
  | 'plan_selected'
  | 'payment_completed'
  | 'provisioned';

export interface OnboardingFormData {
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
  /** Hashed immediately on submit — the plaintext password never touches Redis, even transiently. */
  passwordHash: string;
}

export type BillingCycleValue = 'MONTHLY' | 'YEARLY';
export type PaymentStatusValue = 'skipped_trial' | 'completed';

/** Everything the wizard has collected so far, keyed by an opaque sessionId in Redis. */
export interface OnboardingSessionData {
  step: OnboardingStep;
  form: OnboardingFormData;
  emailVerified: boolean;
  planSlug?: string;
  billingCycle?: BillingCycleValue;
  paymentStatus?: PaymentStatusValue;
  paymentReference?: string;
  provisionedTenantId?: string;
  provisionedSlug?: string;
  createdAt: string;
  /** OTP challenge state — there's no User row yet to attach a real OtpCode to. */
  otpCodeHash?: string;
  otpExpiresAt?: string;
  otpAttempts?: number;
  otpLastSentAt?: string;
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
