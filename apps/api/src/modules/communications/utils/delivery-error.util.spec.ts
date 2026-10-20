import { describe, expect, it } from 'vitest';

import { humanizeDeliveryError } from './delivery-error.util';

describe('humanizeDeliveryError', () => {
  it('translates the provider-not-configured cases into plain language', () => {
    expect(humanizeDeliveryError('SMS', 'Kaleyra is not configured.')).toMatch(/has not set up the SMS provider/);
    expect(humanizeDeliveryError('SMS', 'No Kaleyra SMS sender id is configured.')).toMatch(/SMS sender ID/);
    expect(humanizeDeliveryError('WHATSAPP', 'No Kaleyra WhatsApp number is configured.')).toMatch(/WhatsApp sender number/);
  });

  it('passes a provider rejection through, prefixed with the channel', () => {
    expect(humanizeDeliveryError('SMS', 'Kaleyra SMS request failed: 400 invalid number')).toBe('SMS delivery failed: Kaleyra SMS request failed: 400 invalid number');
  });

  it('WhatsApp failures carry the 24-hour-window explanation', () => {
    expect(humanizeDeliveryError('WHATSAPP', 'Kaleyra WhatsApp request failed: 400 {}')).toMatch(/24-hour window/);
  });

  it('never returns more than 400 characters and handles empty input', () => {
    expect(humanizeDeliveryError('EMAIL', 'x'.repeat(2000)).length).toBeLessThanOrEqual(400);
    expect(humanizeDeliveryError('EMAIL', '')).toBe('Email delivery failed.');
  });
});
