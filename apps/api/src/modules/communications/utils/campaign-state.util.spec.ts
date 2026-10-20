import { describe, expect, it } from 'vitest';

import { AppError } from '../../../core/errors/app-error';

import { assertCanTransition, canTransition, failureReasonFor, finalStatus } from './campaign-state.util';

describe('campaign state machine', () => {
  it('edit: only DRAFT and SCHEDULED', () => {
    expect(canTransition('DRAFT', 'edit')).toBe(true);
    expect(canTransition('SCHEDULED', 'edit')).toBe(true);
    for (const s of ['SENDING', 'SENT', 'PARTIAL', 'FAILED', 'CANCELLED'] as const) expect(canTransition(s, 'edit')).toBe(false);
  });

  it('cancel: DRAFT, SCHEDULED and SENDING; never a finished one', () => {
    for (const s of ['DRAFT', 'SCHEDULED', 'SENDING'] as const) expect(canTransition(s, 'cancel')).toBe(true);
    for (const s of ['SENT', 'PARTIAL', 'FAILED', 'CANCELLED'] as const) expect(canTransition(s, 'cancel')).toBe(false);
  });

  it('retry: only finished campaigns (SENT, PARTIAL, FAILED); not while sending or cancelled', () => {
    for (const s of ['SENT', 'PARTIAL', 'FAILED'] as const) expect(canTransition(s, 'retry')).toBe(true);
    for (const s of ['DRAFT', 'SCHEDULED', 'SENDING', 'CANCELLED'] as const) expect(canTransition(s, 'retry')).toBe(false);
  });

  it('send-now: only a DRAFT', () => {
    expect(canTransition('DRAFT', 'send')).toBe(true);
    expect(canTransition('SCHEDULED', 'send')).toBe(false);
  });

  it('a forbidden transition throws a 409 INVALID_STATE with a helpful sentence', () => {
    try {
      assertCanTransition('SENT', 'cancel');
      throw new Error('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      const e = error as AppError;
      expect(e.httpStatus).toBe(409);
      expect(e.code).toBe('INVALID_STATE');
      expect(e.message).toContain('sent');
      expect(e.message).toContain('cannot be cancelled');
    }
  });
});

describe('finalStatus', () => {
  it('everything delivered is SENT; expected skips (opt-out / no contact) do not downgrade it', () => {
    expect(finalStatus({ total: 10, sent: 8, failed: 0, skippedProblem: 0 })).toBe('SENT');
  });
  it('any failure or quota/disabled skip makes it PARTIAL', () => {
    expect(finalStatus({ total: 10, sent: 8, failed: 2, skippedProblem: 0 })).toBe('PARTIAL');
    expect(finalStatus({ total: 10, sent: 8, failed: 0, skippedProblem: 2 })).toBe('PARTIAL');
  });
  it('nothing delivered is FAILED', () => {
    expect(finalStatus({ total: 10, sent: 0, failed: 10, skippedProblem: 0 })).toBe('FAILED');
    expect(finalStatus({ total: 10, sent: 0, failed: 0, skippedProblem: 0 })).toBe('FAILED');
  });
  it('failure reason explains an all-skipped campaign and is null when something went out', () => {
    expect(failureReasonFor({ total: 5, sent: 2, failed: 0, skippedProblem: 0, skipped: 3 })).toBeNull();
    expect(failureReasonFor({ total: 5, sent: 0, failed: 0, skippedProblem: 0, skipped: 5 })).toMatch(/skipped/);
    expect(failureReasonFor({ total: 5, sent: 0, failed: 5, skippedProblem: 0, skipped: 0 })).toMatch(/failed recipients/);
  });
});
