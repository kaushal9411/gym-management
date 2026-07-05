import { randomUUID } from 'node:crypto';

import { AppError } from '../../../core/errors/app-error';
import { ErrorCode } from '../../../core/errors/error-codes';
import { redis } from '../../../infrastructure/cache/redis';
import type { OnboardingSessionData, OnboardingStep } from '../types/onboarding.types';

const SESSION_TTL_SECONDS = 3600; // 1 hour — an abandoned wizard is discarded, not left dangling forever
const sessionKey = (sessionId: string) => `onboarding:session:${sessionId}`;

/**
 * The wizard has no tenant/user to attach state to until the very last
 * step, so intermediate progress (form data, OTP-verified flag, chosen
 * plan/subdomain, payment status) lives in Redis under an opaque session
 * token — never in Postgres, never in a cookie. This is intentionally
 * ephemeral: if the visitor abandons the wizard, there's nothing to clean
 * up in the durable database.
 */
export class OnboardingSessionService {
  async create(form: OnboardingSessionData['form']): Promise<string> {
    const sessionId = randomUUID();
    const data: OnboardingSessionData = {
      step: 'registered',
      form,
      emailVerified: false,
      createdAt: new Date().toISOString(),
    };
    await redis.set(sessionKey(sessionId), JSON.stringify(data), 'EX', SESSION_TTL_SECONDS);
    return sessionId;
  }

  async get(sessionId: string): Promise<OnboardingSessionData> {
    const raw = await redis.get(sessionKey(sessionId));
    if (!raw) {
      throw new AppError(
        ErrorCode.TOKEN_EXPIRED,
        'This registration session has expired or does not exist. Please start again.',
        410,
      );
    }
    return JSON.parse(raw) as OnboardingSessionData;
  }

  async update(sessionId: string, patch: Partial<OnboardingSessionData>): Promise<OnboardingSessionData> {
    const current = await this.get(sessionId);
    const next: OnboardingSessionData = { ...current, ...patch };
    await redis.set(sessionKey(sessionId), JSON.stringify(next), 'EX', SESSION_TTL_SECONDS);
    return next;
  }

  async setStep(sessionId: string, step: OnboardingStep): Promise<void> {
    await this.update(sessionId, { step });
  }

  async delete(sessionId: string): Promise<void> {
    await redis.del(sessionKey(sessionId));
  }

  /** Throws with a clear, ordered message if a required prior step hasn't happened yet. */
  assertStepReached(session: OnboardingSessionData, required: OnboardingStep): void {
    const order: OnboardingStep[] = [
      'registered', 'otp_sent', 'email_verified', 'plan_selected', 'payment_completed', 'provisioned',
    ];
    if (order.indexOf(session.step) < order.indexOf(required)) {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        `Please complete the previous steps first (currently at "${session.step}").`,
        409,
      );
    }
  }
}

export const onboardingSessionService = new OnboardingSessionService();
