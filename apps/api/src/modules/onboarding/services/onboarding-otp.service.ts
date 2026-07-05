import { env } from '../../../config/env';
import { AppError } from '../../../core/errors/app-error';
import { ErrorCode } from '../../../core/errors/error-codes';
import { eventBus } from '../../../core/events/event-bus';
import { generateNumericOtp, hashToken } from '../../../core/security/token.util';
import type { OnboardingSessionData } from '../types/onboarding.types';

import { onboardingSessionService } from './onboarding-session.service';

const MAX_ATTEMPTS = 5;

/**
 * OTP for the wizard's "verify email" step, stored on the Redis-backed
 * onboarding session itself (see onboarding-session.service.ts) rather
 * than the `otp_codes` Postgres table — that table's schema requires a
 * real tenantId + userId, neither of which exist until provisioning
 * completes at the very end of the wizard.
 */
export class OnboardingOtpService {
  async send(sessionId: string): Promise<void> {
    const session = await onboardingSessionService.get(sessionId);

    if (session.otpLastSentAt) {
      const elapsedMs = Date.now() - new Date(session.otpLastSentAt).getTime();
      if (elapsedMs < env.security.otpResendCooldownSeconds * 1000) {
        throw new AppError(ErrorCode.RATE_LIMITED, 'Please wait before requesting another code.', 429);
      }
    }

    const code = generateNumericOtp(env.security.otpLength);
    const expiresAt = new Date(Date.now() + env.security.otpTtlSeconds * 1000);

    await onboardingSessionService.update(sessionId, {
      otpCodeHash: hashToken(code),
      otpExpiresAt: expiresAt.toISOString(),
      otpAttempts: 0,
      otpLastSentAt: new Date().toISOString(),
      step: session.step === 'registered' ? 'otp_sent' : session.step,
    });

    eventBus.emitEvent('onboarding.otp_issued', {
      email: session.form.email,
      code,
      expiresInMinutes: Math.round(env.security.otpTtlSeconds / 60),
    });
  }

  async verify(sessionId: string, code: string): Promise<OnboardingSessionData> {
    const session = await onboardingSessionService.get(sessionId);

    if (!session.otpCodeHash || !session.otpExpiresAt) {
      throw new AppError(ErrorCode.OTP_INVALID, 'No verification code was requested. Please request one first.', 400);
    }
    if (new Date(session.otpExpiresAt).getTime() < Date.now()) {
      throw new AppError(ErrorCode.OTP_EXPIRED, 'This code has expired. Request a new one.', 401);
    }
    if ((session.otpAttempts ?? 0) >= MAX_ATTEMPTS) {
      throw new AppError(ErrorCode.OTP_INVALID, 'Too many incorrect attempts. Request a new code.', 401);
    }
    if (hashToken(code) !== session.otpCodeHash) {
      await onboardingSessionService.update(sessionId, { otpAttempts: (session.otpAttempts ?? 0) + 1 });
      throw new AppError(ErrorCode.OTP_INVALID, 'Incorrect code. Check and try again.', 401);
    }

    return onboardingSessionService.update(sessionId, {
      emailVerified: true,
      step: 'email_verified',
      otpCodeHash: undefined,
    });
  }
}

export const onboardingOtpService = new OnboardingOtpService();
