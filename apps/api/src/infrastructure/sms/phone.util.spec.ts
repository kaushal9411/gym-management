import { describe, expect, it } from 'vitest';

import { toE164 } from './phone.util';

describe('toE164', () => {
  it('prepends 91 to a bare 10-digit number', () => {
    expect(toE164('9876543210')).toBe('+919876543210');
  });

  it('leaves an already-prefixed number untouched (round-trips)', () => {
    expect(toE164('+919876543210')).toBe('+919876543210');
  });

  it('strips formatting characters before deciding', () => {
    expect(toE164('98765-43210')).toBe('+919876543210');
    expect(toE164('(987) 654-3210')).toBe('+919876543210');
  });

  it('does not touch a non-10-digit number beyond adding a + prefix', () => {
    expect(toE164('14155552671')).toBe('+14155552671');
  });
});
