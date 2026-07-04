/**
 * Remember-me persists ONLY the email for prefill — never credentials or
 * tokens. Access tokens live in memory; the refresh token is an httpOnly
 * cookie owned by the API (later phase).
 */
const STORAGE_KEY = 'fitcloud.remembered-email';

export function getRememberedEmail(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setRememberedEmail(email: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (email) {
      window.localStorage.setItem(STORAGE_KEY, email);
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // storage unavailable (private mode) — a prefill nicety, never an error
  }
}
