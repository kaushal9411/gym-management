import { describe, expect, it } from 'vitest';

import { awarenessSourceFor, csvCell, followUpBucket, isBlockingLeadStatus, phoneKeyOf, splitName, statusTransitionError } from './lead-rules.util';

describe('phoneKeyOf (duplicate normalisation)', () => {
  it('collapses formatting, country code and trunk zero to the last 10 digits', () => {
    const keys = ['9000012345', '+91 90000-12345', '090000 12345', '(+91) 9000012345'].map(phoneKeyOf);
    expect(new Set(keys)).toEqual(new Set(['9000012345']));
  });
  it('keeps short numbers as-is', () => {
    expect(phoneKeyOf('123-4567')).toBe('1234567');
  });
});

describe('isBlockingLeadStatus', () => {
  it('open leads block; lost / converted do not', () => {
    for (const s of ['NEW', 'CONTACTED', 'VISIT_SCHEDULED', 'TRIAL_DONE', 'NEGOTIATION'] as const) expect(isBlockingLeadStatus(s)).toBe(true);
    expect(isBlockingLeadStatus('LOST')).toBe(false);
    expect(isBlockingLeadStatus('CONVERTED')).toBe(false);
  });
});

describe('statusTransitionError', () => {
  it('allows open <-> open, open -> LOST with reason, LOST -> open', () => {
    expect(statusTransitionError('NEW', 'CONTACTED')).toBeNull();
    expect(statusTransitionError('NEGOTIATION', 'CONTACTED')).toBeNull();
    expect(statusTransitionError('TRIAL_DONE', 'LOST', 'PRICE_TOO_HIGH')).toBeNull();
    expect(statusTransitionError('LOST', 'NEW')).toBeNull();
  });
  it('rejects same status, LOST without reason, CONVERTED target and CONVERTED source', () => {
    expect(statusTransitionError('NEW', 'NEW')).toMatch(/already/);
    expect(statusTransitionError('NEW', 'LOST')).toMatch(/reason/);
    expect(statusTransitionError('NEGOTIATION', 'CONVERTED')).toMatch(/convert endpoint/);
    expect(statusTransitionError('CONVERTED', 'NEW')).toMatch(/cannot change/);
    expect(statusTransitionError('CONVERTED', 'LOST', 'OTHER')).toMatch(/cannot change/);
  });
});

describe('followUpBucket (UTC days)', () => {
  const now = new Date('2026-10-11T14:00:00Z');
  it('buckets by UTC day', () => {
    expect(followUpBucket(new Date('2026-10-10T23:59:00Z'), 'NEW', now)).toBe('overdue');
    expect(followUpBucket(new Date('2026-10-11T00:00:00Z'), 'NEW', now)).toBe('today');
    expect(followUpBucket(new Date('2026-10-11T08:00:00Z'), 'CONTACTED', now)).toBe('today');
    expect(followUpBucket(new Date('2026-10-11T23:59:59Z'), 'CONTACTED', now)).toBe('today');
    expect(followUpBucket(new Date('2026-10-12T00:00:00Z'), 'NEGOTIATION', now)).toBe('upcoming');
  });
  it('is none without a date or for closed leads', () => {
    expect(followUpBucket(null, 'NEW', now)).toBe('none');
    expect(followUpBucket(new Date('2026-10-01T00:00:00Z'), 'LOST', now)).toBe('none');
    expect(followUpBucket(new Date('2026-10-01T00:00:00Z'), 'CONVERTED', now)).toBe('none');
  });
});

describe('csvCell', () => {
  it('neutralises spreadsheet formulas and quotes specials', () => {
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvCell('+91 90000')).toBe("'+91 90000");
    expect(csvCell('-1')).toBe("'-1");
    expect(csvCell('@SUM(A1)')).toBe("'@SUM(A1)");
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell(null)).toBe('');
    expect(csvCell('plain')).toBe('plain');
  });
});

describe('splitName / awarenessSourceFor', () => {
  it('splits first / rest', () => {
    expect(splitName('Asha')).toEqual({ firstName: 'Asha', lastName: null });
    expect(splitName('  Asha  Devi   Rao ')).toEqual({ firstName: 'Asha', lastName: 'Devi Rao' });
  });
  it('maps lead sources to member awareness sources', () => {
    expect(awarenessSourceFor('REFERRAL')).toBe('FRIEND_REFERRAL');
    expect(awarenessSourceFor('WEBSITE')).toBe('ONLINE_SEARCH');
    expect(awarenessSourceFor('PHONE_CALL')).toBe('OTHER');
  });
});
