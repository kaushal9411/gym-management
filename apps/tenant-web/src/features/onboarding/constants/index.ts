export const ONBOARDING_ROUTE = '/register';

export const OTP_LENGTH = 6;
export const OTP_RESEND_COOLDOWN_SECONDS = 30;

export const SUBDOMAIN_DEBOUNCE_MS = 500;

export const PAYMENT_PROVIDERS: { value: 'stripe' | 'razorpay' | 'paypal'; label: string }[] = [
  { value: 'stripe', label: 'Card (Stripe)' },
  { value: 'razorpay', label: 'UPI / Cards (Razorpay)' },
  { value: 'paypal', label: 'PayPal' },
];

/** sessionStorage key — wizard progress only, never credentials. */
export const WIZARD_STORAGE_KEY = 'fitcloud.onboarding.wizard';
