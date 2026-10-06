import Twilio from 'twilio';

import { logger } from '../../core/logging/logger';
import { platformNotificationCredentialService } from '../../modules/admin-notification-settings/services/platform-notification-credential.service';

export interface SmsSendResult {
  sid: string;
}

/**
 * Thin Twilio wrapper for both SMS and WhatsApp — WhatsApp goes through the
 * exact same `client.messages.create()` call, just with a `whatsapp:` prefix
 * on `from`/`to` (Twilio's own convention, no separate API). Credentials are
 * resolved fresh on every send via `PlatformNotificationCredentialService`
 * (DB row, falling back to `.env`) — never cached, so an admin's credential
 * update takes effect on the very next send. Mirrors `fcm.client.ts`'s
 * "never required to boot, every failure is caught and logged, never
 * thrown past the caller" shape for the NOT CONFIGURED case — but unlike
 * FCM, a genuine send failure (bad number, Twilio-trial unverified
 * recipient, etc.) IS rethrown, so the caller (sms.worker.ts/
 * whatsapp.worker.ts) can write a FAILED delivery-log row; it just must
 * never let that break the email/push legs of the same notification event,
 * which is already guaranteed by those being separate queue jobs.
 */
class TwilioClient {
  async sendSms(params: { to: string; body: string }): Promise<SmsSendResult | null> {
    const config = await platformNotificationCredentialService.resolveTwilioConfig().catch(() => null);
    if (!config) {
      logger.warn('SMS not sent — Twilio is not configured', { to: params.to });
      return null;
    }
    if (!config.smsFromNumber) {
      logger.warn('SMS not sent — no Twilio SMS from-number configured', { to: params.to });
      return null;
    }
    const client = Twilio(config.accountSid, config.authToken);
    const message = await client.messages.create({ to: params.to, from: config.smsFromNumber, body: params.body });
    return { sid: message.sid };
  }

  async sendWhatsApp(params: { to: string; body: string }): Promise<SmsSendResult | null> {
    const config = await platformNotificationCredentialService.resolveTwilioConfig().catch(() => null);
    if (!config) {
      logger.warn('WhatsApp message not sent — Twilio is not configured', { to: params.to });
      return null;
    }
    if (!config.whatsappFromNumber) {
      logger.warn('WhatsApp message not sent — no Twilio WhatsApp from-number configured', { to: params.to });
      return null;
    }
    const client = Twilio(config.accountSid, config.authToken);
    const message = await client.messages.create({
      to: `whatsapp:${params.to}`,
      from: `whatsapp:${config.whatsappFromNumber}`,
      body: params.body,
    });
    return { sid: message.sid };
  }
}

export const twilioClient = new TwilioClient();
