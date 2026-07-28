export const ONBOARDING_ROUTE = '/register';

export const OTP_LENGTH = 6;
export const OTP_RESEND_COOLDOWN_SECONDS = 30;

export const SUBDOMAIN_DEBOUNCE_MS = 500;

/** Only Razorpay is offered — Stripe/PayPal stay valid backend enum values (untouched) but are no longer selectable from either checkout UI. */
export const PAYMENT_PROVIDERS: { value: 'stripe' | 'razorpay' | 'paypal'; label: string }[] = [
  { value: 'razorpay', label: 'UPI / Cards (Razorpay)' },
];

/** sessionStorage key — wizard progress only, never credentials. */
export const WIZARD_STORAGE_KEY = 'fitcloud.onboarding.wizard';
