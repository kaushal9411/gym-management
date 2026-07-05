/**
 * Captcha verification port. `NoopCaptchaVerifier` (active by default) is
 * an honest stub — it always passes, since there's no reCAPTCHA/hCaptcha
 * site key configured for local dev. A real provider drops in behind this
 * same interface without touching the onboarding service that calls it.
 */
export interface CaptchaVerifier {
  verify(token: string): Promise<boolean>;
}

class NoopCaptchaVerifier implements CaptchaVerifier {
  async verify(token: string): Promise<boolean> {
    // Still requires a non-empty token from the client, so a form that
    // "forgot" to render the captcha widget fails loudly instead of this
    // silently accepting an absent field forever.
    return token.trim().length > 0;
  }
}

export const captchaVerifier: CaptchaVerifier = new NoopCaptchaVerifier();
