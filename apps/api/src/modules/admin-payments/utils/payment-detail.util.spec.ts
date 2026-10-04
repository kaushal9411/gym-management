import { describe, expect, it } from 'vitest';

import { MASKED, buildPaymentTimeline, maskSensitive } from './payment-detail.util';

const t = (s: string) => new Date(`2026-10-01T${s}Z`);
const base = {
  provider: 'RAZORPAY',
  amount: '499.00',
  currency: 'INR',
  createdAt: t('10:00:00'),
  updatedAt: t('10:05:00'),
  paidAt: null,
  failureReason: null,
};

describe('buildPaymentTimeline', () => {
  it('orders created, webhooks, paid', () => {
    const tl = buildPaymentTimeline({
      ...base,
      status: 'SUCCEEDED',
      paidAt: t('10:02:00'),
      transactions: [
        {
          eventType: 'payment.captured',
          signatureValid: true,
          createdAt: t('10:01:00'),
          processedAt: t('10:01:01'),
        },
        {
          eventType: 'payment.authorized',
          signatureValid: false,
          createdAt: t('10:00:30'),
          processedAt: null,
        },
      ],
    });
    expect(tl.map((e) => e.event)).toEqual([
      'created',
      'payment.authorized',
      'payment.captured',
      'paid',
    ]);
    expect(tl[1]!.detail).toContain('INVALID');
    expect(tl[2]!.detail).toContain('signature valid; processed');
    expect(tl[0]!.detail).toBe('RAZORPAY payment of 499.00 INR recorded');
  });
  it('failed payment ends with the reason', () => {
    const tl = buildPaymentTimeline({
      ...base,
      status: 'FAILED',
      failureReason: 'Card declined',
      transactions: [],
    });
    expect(tl.at(-1)).toMatchObject({ event: 'failed', detail: 'Card declined' });
  });
  it('pending payment has only the created event', () => {
    expect(buildPaymentTimeline({ ...base, status: 'PENDING', transactions: [] })).toHaveLength(1);
  });
});

describe('maskSensitive', () => {
  it('masks card/vpa/email/contact keys and email strings, keeps ids and amounts', () => {
    const out = maskSensitive({
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: 'pay_1',
            amount: 100,
            email: 'jane@x.com',
            contact: '+9100',
            vpa: 'a@upi',
            card: { last4: '1111' },
            notes: { who: 'bob@corp.io' },
          },
        },
      },
    }) as { payload: { payment: { entity: Record<string, unknown> } } };
    const e = out.payload.payment.entity;
    expect(e.id).toBe('pay_1');
    expect(e.amount).toBe(100);
    expect(e.email).toBe(MASKED);
    expect(e.contact).toBe(MASKED);
    expect(e.vpa).toBe(MASKED);
    expect(e.card).toBe(MASKED);
    expect((e.notes as { who: string }).who).toBe('b***@corp.io');
  });
});
