import { describe, expect, it } from 'vitest';

import { updateLeadSchema } from '../../admin-leads/validators/admin-lead.validators';

import { contactRequestSchema } from './contact.validators';

const valid = { name: 'Asha Verma', email: 'asha@example.com', message: 'I run two gyms and want a demo.' };

describe('contactRequestSchema', () => {
  it('accepts the old status-screen payload and fills defaults', () => {
    const r = contactRequestSchema.safeParse({ ...valid, topic: 'billing', gymSlug: 'goldgym' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.source).toBe('STATUS_SCREEN');
  });

  it('accepts the full home-page payload', () => {
    const r = contactRequestSchema.safeParse({
      ...valid,
      topic: 'demo',
      phone: '+91 98765 43210',
      gymName: 'Iron House',
      gymSize: '100-300',
      source: 'HOME_PAGE',
    });
    expect(r.success).toBe(true);
  });

  it('treats untouched optional fields (empty strings) as absent', () => {
    const r = contactRequestSchema.safeParse({ ...valid, phone: '', gymName: '', gymSize: '' });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.phone).toBeUndefined();
      expect(r.data.gymName).toBeUndefined();
      expect(r.data.gymSize).toBeUndefined();
    }
  });

  it.each([
    ['short name', { name: 'A' }],
    ['bad email', { email: 'nope' }],
    ['short message', { message: 'too short' }],
    ['unknown topic', { topic: 'jobs' }],
    ['bad phone', { phone: 'abc' }],
    ['unknown size band', { gymSize: 'huge' }],
    ['unknown source', { source: 'POPUP' }],
  ])('rejects %s', (_label, patch) => {
    expect(contactRequestSchema.safeParse({ ...valid, ...patch }).success).toBe(false);
  });
});

describe('updateLeadSchema', () => {
  it('needs at least one field', () => {
    expect(updateLeadSchema.safeParse({}).success).toBe(false);
  });

  it('accepts a status, notes or null notes', () => {
    expect(updateLeadSchema.safeParse({ status: 'QUALIFIED' }).success).toBe(true);
    expect(updateLeadSchema.safeParse({ notes: 'Called, wants a quote.' }).success).toBe(true);
    expect(updateLeadSchema.safeParse({ notes: null }).success).toBe(true);
  });

  it('rejects unknown keys and statuses', () => {
    expect(updateLeadSchema.safeParse({ status: 'MAYBE' }).success).toBe(false);
    expect(updateLeadSchema.safeParse({ status: 'NEW', email: 'x@y.com' }).success).toBe(false);
  });
});
