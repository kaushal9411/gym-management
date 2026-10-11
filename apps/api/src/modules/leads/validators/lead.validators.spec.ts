import { describe, expect, it } from 'vitest';

import {
  addActivitySchema,
  changeStatusSchema,
  convertLeadSchema,
  createLeadSchema,
  followUpsQuerySchema,
  leadAnalyticsQuerySchema,
  listLeadsQuerySchema,
  updateLeadSchema,
} from './lead.validators';

describe('createLeadSchema', () => {
  it('accepts the minimum and applies defaults', () => {
    const r = createLeadSchema.parse({ name: ' Asha Rao ', phone: '9000012345' });
    expect(r.name).toBe('Asha Rao');
    expect(r.source).toBe('WALK_IN');
  });
  it('lowercases email and rejects bad phone / unknown source', () => {
    expect(createLeadSchema.parse({ name: 'A', phone: '+91 90000-12345', email: 'A@B.COM' }).email).toBe('a@b.com');
    expect(createLeadSchema.safeParse({ name: 'A', phone: 'abc' }).success).toBe(false);
    expect(createLeadSchema.safeParse({ name: 'A', phone: '9000012345', source: 'TV' }).success).toBe(false);
    expect(createLeadSchema.safeParse({ name: '', phone: '9000012345' }).success).toBe(false);
  });
});

describe('updateLeadSchema', () => {
  it('requires at least one field and allows nulling optional fields', () => {
    expect(updateLeadSchema.safeParse({}).success).toBe(false);
    expect(updateLeadSchema.parse({ email: null, nextFollowUpAt: null }).email).toBeNull();
  });
  it('does not accept status / assignment changes through PATCH /:id', () => {
    const r = updateLeadSchema.parse({ notes: 'x', status: 'LOST', assignedToUserId: '7c3b1c8e-3f0e-4e4f-9d66-5f7f8d2a1b11' } as never);
    expect(r).toEqual({ notes: 'x' });
  });
});

describe('changeStatusSchema', () => {
  it('requires a reason for LOST and blocks CONVERTED', () => {
    const lost = changeStatusSchema.safeParse({ status: 'LOST' });
    expect(lost.success).toBe(false);
    expect(changeStatusSchema.safeParse({ status: 'LOST', lostReason: 'PRICE_TOO_HIGH' }).success).toBe(true);
    expect(changeStatusSchema.safeParse({ status: 'CONVERTED' }).success).toBe(false);
    expect(changeStatusSchema.safeParse({ status: 'CONTACTED' }).success).toBe(true);
  });
});

describe('addActivitySchema', () => {
  it('requires a note for NOTE and only allows manual types', () => {
    expect(addActivitySchema.safeParse({ type: 'NOTE' }).success).toBe(false);
    expect(addActivitySchema.safeParse({ type: 'NOTE', note: 'hi' }).success).toBe(true);
    expect(addActivitySchema.safeParse({ type: 'CALL', outcome: 'No answer', nextFollowUpAt: '2026-10-12T10:00:00Z' }).success).toBe(true);
    expect(addActivitySchema.safeParse({ type: 'STATUS_CHANGE', note: 'x' }).success).toBe(false);
    expect(addActivitySchema.safeParse({ type: 'FOLLOW_UP' }).success).toBe(false);
  });
});

describe('list / follow-up / analytics queries', () => {
  it('parses repeated and comma separated enum arrays', () => {
    expect(listLeadsQuerySchema.parse({ status: 'NEW,LOST' }).status).toEqual(['NEW', 'LOST']);
    expect(listLeadsQuerySchema.parse({ status: ['NEW', 'CONTACTED'], source: 'WALK_IN' })).toMatchObject({ status: ['NEW', 'CONTACTED'], source: ['WALK_IN'], page: 1, limit: 20 });
    expect(listLeadsQuerySchema.safeParse({ status: 'BOGUS' }).success).toBe(false);
    expect(listLeadsQuerySchema.safeParse({ assignedTo: 'me', followUp: 'overdue' }).success).toBe(true);
    expect(listLeadsQuerySchema.safeParse({ followUp: 'later' }).success).toBe(false);
  });
  it('defaults follow-ups to mine/due', () => {
    expect(followUpsQuerySchema.parse({})).toMatchObject({ scope: 'mine', bucket: 'due', limit: 20 });
  });
  it('analytics: default 30d, custom needs ordered dates within 366 days', () => {
    expect(leadAnalyticsQuerySchema.parse({}).range).toBe('30d');
    expect(leadAnalyticsQuerySchema.safeParse({ range: 'custom' }).success).toBe(false);
    expect(leadAnalyticsQuerySchema.safeParse({ range: 'custom', dateFrom: '2026-10-05', dateTo: '2026-10-01' }).success).toBe(false);
    expect(leadAnalyticsQuerySchema.safeParse({ range: 'custom', dateFrom: '2025-01-01', dateTo: '2026-10-01' }).success).toBe(false);
    expect(leadAnalyticsQuerySchema.safeParse({ range: 'custom', dateFrom: '2026-10-01', dateTo: '2026-10-05' }).success).toBe(true);
    expect(leadAnalyticsQuerySchema.safeParse({ range: 'decade' }).success).toBe(false);
  });
  it('convert body is all-optional', () => {
    expect(convertLeadSchema.safeParse({}).success).toBe(true);
    expect(convertLeadSchema.safeParse({ planId: 'nope' }).success).toBe(false);
  });
});
