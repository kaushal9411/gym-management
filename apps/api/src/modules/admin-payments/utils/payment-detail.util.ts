export interface TimelineEvent {
  at: string;
  event: string;
  detail: string;
}

export interface TimelineSource {
  status: string;
  provider: string;
  amount: { toString(): string } | number | string;
  currency: string;
  createdAt: Date;
  updatedAt: Date;
  paidAt: Date | null;
  failureReason: string | null;
  transactions: Array<{
    eventType: string;
    signatureValid: boolean;
    createdAt: Date;
    processedAt: Date | null;
  }>;
}

/** Status timeline, oldest first (stable for equal timestamps: created, webhooks, then the outcome). */
export function buildPaymentTimeline(p: TimelineSource): TimelineEvent[] {
  const events: Array<TimelineEvent & { t: number; o: number }> = [];
  const push = (at: Date, o: number, event: string, detail: string) =>
    events.push({ at: at.toISOString(), event, detail, t: at.getTime(), o });
  push(
    p.createdAt,
    0,
    'created',
    `${p.provider} payment of ${Number(p.amount.toString()).toFixed(2)} ${p.currency} recorded`,
  );
  for (const t of p.transactions)
    push(
      t.createdAt,
      1,
      t.eventType,
      `Webhook received: signature ${t.signatureValid ? 'valid' : 'INVALID'}; ${t.processedAt ? 'processed' : 'not processed'}`,
    );
  if (p.status !== 'PENDING' && p.status !== 'FAILED')
    // Gateway payments never set paidAt; the status flip time (updatedAt) is the best available proxy.
    push(p.paidAt ?? p.updatedAt, 2, 'paid', 'Payment received');
  if (p.status === 'FAILED') push(p.updatedAt, 2, 'failed', p.failureReason ?? 'Payment failed');
  if (p.status === 'REFUNDED') push(p.updatedAt, 3, 'refunded', 'Payment refunded');
  if (p.status === 'PARTIALLY_REFUNDED')
    push(p.updatedAt, 3, 'partially_refunded', 'Payment partially refunded');
  return events
    .sort((a, b) => a.t - b.t || a.o - b.o)
    .map(({ at, event, detail }) => ({ at, event, detail }));
}

// ── Masking ────────────────────────────────────────────────────────────────
const SENSITIVE_KEY =
  /(e-?mail|contact|phone|mobile|vpa|upi|card|cvv|pan|secret|token|password|authorization|api[_-]?key|signature|account|ifsc|iban|bank)/i;
const EMAIL = /^([^@\s])[^@\s]*@([^@\s]+)$/;

export const MASKED = '[masked]';

/** Deep copy with sensitive keys (card/UPI VPA/email/phone/bank/secrets) replaced and any email-looking string partially masked. */
export function maskSensitive(value: unknown, depth = 0): unknown {
  if (depth > 10) return MASKED;
  if (typeof value === 'string')
    return value.replace(EMAIL, (_m, a: string, d: string) => `${a}***@${d}`);
  if (Array.isArray(value)) return value.map((v) => maskSensitive(v, depth + 1));
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>))
      out[k] =
        SENSITIVE_KEY.test(k) && v !== null && v !== undefined
          ? MASKED
          : maskSensitive(v, depth + 1);
    return out;
  }
  return value;
}
