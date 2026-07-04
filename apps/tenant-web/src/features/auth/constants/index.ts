/** Route table — the single source of truth for auth navigation. */
export const AUTH_ROUTES = {
  login: '/login',
  register: '/register',
  forgotPassword: '/forgot-password',
  resetPassword: '/reset-password',
  verifyEmail: '/verify-email',
  verifyOtp: '/verify-otp',
  resendOtp: '/resend-otp',
  twoFactor: '/two-factor',
  invitation: '/invitation',
  sessionExpired: '/session-expired',
  accessDenied: '/access-denied',
  accountSuspended: '/account-suspended',
  subscriptionExpired: '/subscription-expired',
  trialExpired: '/trial-expired',
  maintenance: '/maintenance',
} as const;

export const OTP_LENGTH = 6;
export const OTP_RESEND_COOLDOWN_SECONDS = 30;
export const OTP_EXPIRY_SECONDS = 300;

export const PASSWORD_MIN_LENGTH = 8;

/** Where a successful login will eventually land (dashboard = later phase). */
export const POST_LOGIN_REDIRECT = '/';

/**
 * ── MOCK SERVICE SCRIPT ──────────────────────────────────────────────────
 * The mock auth service produces deterministic outcomes so every UI state
 * can be exercised without a backend:
 *
 *   password "Password@123"        → success (any email not listed below)
 *   locked@…                       → ACCOUNT_LOCKED
 *   suspended@…                    → ACCOUNT_SUSPENDED  → /account-suspended
 *   billing@…                      → SUBSCRIPTION_EXPIRED → /subscription-expired
 *   trial@…                        → TRIAL_EXPIRED      → /trial-expired
 *   unverified@…                   → EMAIL_NOT_VERIFIED → /verify-email
 *   otp@… / 2fa@…                  → OTP challenge      → /verify-otp | /two-factor
 *   any other password             → INVALID_CREDENTIALS
 *   OTP "123456" valid · "000000" expired · anything else invalid
 *   reset/invitation token "expired" → expired state
 *   register slug "goldgym|fitnesshub|musclefactory|taken" → SLUG_TAKEN
 * ─────────────────────────────────────────────────────────────────────────
 */
export const MOCK_HAPPY_PASSWORD = 'Password@123';
export const MOCK_VALID_OTP = '123456';
