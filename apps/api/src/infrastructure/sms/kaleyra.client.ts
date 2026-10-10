import { logger } from '../../core/logging/logger';
import { platformNotificationCredentialService } from '../../modules/admin-notification-settings/services/platform-notification-credential.service';

export interface MessageSendResult {
  messageId: string;
}

/** A failure that is deliberately never thrown (unconfigured platform, or configured without a sender id/number for this channel) — distinct from a genuine Kaleyra API error, which IS still thrown/rethrown past this client. */
export interface MessageSendSkipped {
  error: string;
}

interface KaleyraSmsResponse {
  sms?: Array<{ message_id?: string }>;
}

interface KaleyraWhatsAppResponse {
  code?: string;
  data?: { message_id?: string };
  error?: unknown;
}

/**
 * Thin Kaleyra Messages API wrapper for both SMS and WhatsApp (replaces the
 * previous messaging provider, same session — see docs/PROJECT-STATE.md's
 * Prompt 128 addenda). Plain REST, no SDK: `POST /v1/{sid}/sms/json` for
 * SMS, `POST /v2/{sid}/whatsapp/{whatsappNumber}/messages` for WhatsApp
 * (`{whatsappNumber}` in the path is the BUSINESS's own sending number, the
 * recipient goes in the body's `to` — confirmed against Kaleyra's own API
 * reference, not guessed). Credentials are resolved fresh on every send via
 * `PlatformNotificationCredentialService` (DB row, falling back to `.env`)
 * — never cached, so an admin's credential update takes effect on the very
 * next send. Mirrors `fcm.client.ts`'s "never required to boot, every
 * failure is caught and logged, never thrown past the caller" shape for the
 * NOT CONFIGURED case — but unlike FCM, a genuine send failure (bad number,
 * no open WhatsApp session window, etc.) IS rethrown, so the caller
 * (sms.worker.ts/whatsapp.worker.ts) can write a FAILED delivery-log row;
 * it just must never let that break the email/push legs of the same
 * notification event, which is already guaranteed by those being separate
 * queue jobs.
 */
class KaleyraClient {
  async sendSms(params: { to: string; body: string }): Promise<MessageSendResult | MessageSendSkipped> {
    const config = await platformNotificationCredentialService.resolveMessagingConfig().catch(() => null);
    if (!config) {
      const error = 'Kaleyra is not configured.';
      logger.warn(`SMS not sent — ${error}`, { to: params.to });
      return { error };
    }
    if (!config.smsSenderId) {
      const error = 'No Kaleyra SMS sender id is configured.';
      logger.warn(`SMS not sent — ${error}`, { to: params.to });
      return { error };
    }

    const response = await fetch(`https://${config.apiDomain}/v1/${config.sid}/sms/json`, {
      method: 'POST',
      headers: { 'api-key': config.apiKey, 'content-type': 'application/json' },
      body: JSON.stringify({ sms: [{ to: toDigits(params.to), from: config.smsSenderId, body: params.body }] }),
    });
    if (!response.ok) throw new Error(`Kaleyra SMS request failed: ${response.status} ${await response.text()}`);
    const body = (await response.json()) as KaleyraSmsResponse;
    const messageId = body.sms?.[0]?.message_id;
    if (!messageId) throw new Error('Kaleyra SMS response did not include a message_id.');
    return { messageId };
  }

  async sendWhatsApp(params: { to: string; body: string }): Promise<MessageSendResult | MessageSendSkipped> {
    const config = await platformNotificationCredentialService.resolveMessagingConfig().catch(() => null);
    if (!config) {
      const error = 'Kaleyra is not configured.';
      logger.warn(`WhatsApp message not sent — ${error}`, { to: params.to });
      return { error };
    }
    if (!config.whatsappNumber) {
      const error = 'No Kaleyra WhatsApp number is configured.';
      logger.warn(`WhatsApp message not sent — ${error}`, { to: params.to });
      return { error };
    }

    const response = await fetch(`https://${config.apiDomain}/v2/${config.sid}/whatsapp/${config.whatsappNumber}/messages`, {
      method: 'POST',
      headers: { 'api-key': config.apiKey, 'content-type': 'application/json' },
      body: JSON.stringify({
        messaging_object: {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: params.to,
          type: 'text',
          text: { preview_url: 'false', body: params.body },
        },
      }),
    });
    const body = (await response.json().catch(() => null)) as KaleyraWhatsAppResponse | null;
    if (!response.ok || !body?.data?.message_id) {
      throw new Error(`Kaleyra WhatsApp request failed: ${response.status} ${JSON.stringify(body ?? {})}`);
    }
    return { messageId: body.data.message_id };
  }
}

/** Kaleyra's SMS `to` field is numeric (no `+`) — strips everything but digits, from the shared `+91...` E.164 form the rest of the app uses. */
function toDigits(phone: string): string {
  return phone.replace(/\D/g, '');
}

export const kaleyraClient = new KaleyraClient();
