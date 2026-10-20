import { WHATSAPP_ERROR_HINT } from '../constants/limits';

const CHANNEL_LABEL: Record<string, string> = { EMAIL: 'Email', SMS: 'SMS', WHATSAPP: 'WhatsApp', PUSH: 'Push', IN_APP: 'In-app' };

export function channelLabel(channel: string): string {
  return CHANNEL_LABEL[channel] ?? channel;
}

/**
 * Turns a provider / transport error into one sentence a gym owner can act on. Never returns more than 400
 * characters and never includes anything but the error text itself (no addresses or phone numbers are added).
 */
export function humanizeDeliveryError(channel: string, raw: string | undefined | null): string {
  const text = (raw ?? '').trim();
  let message: string;
  if (/Kaleyra is not configured/i.test(text)) {
    message = `The platform has not set up the ${channelLabel(channel)} provider yet, so this could not be sent.`;
  } else if (/No Kaleyra SMS sender id/i.test(text)) {
    message = 'The platform has no SMS sender ID configured yet, so this could not be sent.';
  } else if (/No Kaleyra WhatsApp number/i.test(text)) {
    message = 'The platform has no WhatsApp sender number configured yet, so this could not be sent.';
  } else if (!text) {
    message = `${channelLabel(channel)} delivery failed.`;
  } else {
    message = `${channelLabel(channel)} delivery failed: ${text.replace(/\s+/g, ' ')}`;
  }
  if (channel === 'WHATSAPP' && !/not set up|no whatsapp sender/i.test(message)) message += WHATSAPP_ERROR_HINT;
  return message.length > 400 ? `${message.slice(0, 397)}...` : message;
}
