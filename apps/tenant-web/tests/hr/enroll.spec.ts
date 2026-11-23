import { AxiosError, AxiosHeaders } from 'axios';

import { runEnroll, shouldShowEnrollCard } from '@/features/hr/lib/enroll';
import { toAuthServiceError } from '@/features/auth/services/api-client';

function apiError(status: number, code: string, message: string): AxiosError {
  const config = { headers: new AxiosHeaders() };
  return new AxiosError(message, 'ERR_BAD_REQUEST', config as never, {}, {
    status,
    statusText: String(status),
    headers: {},
    config: config as never,
    data: { success: false, message, data: null, errors: [{ code, message }] },
  });
}

describe('shouldShowEnrollCard', () => {
  it('needs a self key AND NOT_AN_EMPLOYEE', () => {
    expect(shouldShowEnrollCard(true, 'NOT_AN_EMPLOYEE')).toBe(true);
    expect(shouldShowEnrollCard(false, 'NOT_AN_EMPLOYEE')).toBe(false);
    expect(shouldShowEnrollCard(true, undefined)).toBe(false);
    expect(shouldShowEnrollCard(true, 'FORBIDDEN')).toBe(false);
  });

  it('reads the code the web actually gets from a 403 NOT_AN_EMPLOYEE response', () => {
    const err = toAuthServiceError(apiError(403, 'NOT_AN_EMPLOYEE', 'You do not have an employee profile'));
    expect(shouldShowEnrollCard(true, err.details?.apiCode)).toBe(true);
  });
});

describe('runEnroll', () => {
  it('calls enroll exactly once and does not need a manual refetch on success', async () => {
    const enroll = vi.fn().mockResolvedValue({});
    const refetch = vi.fn();
    expect(await runEnroll({ enroll, refetch })).toEqual({ status: 'enrolled' });
    expect(enroll).toHaveBeenCalledTimes(1);
    expect(refetch).not.toHaveBeenCalled(); // the mutation hook invalidates the HR queries itself
  });

  it('treats 409 ALREADY_EMPLOYEE as success-by-refetch', async () => {
    const enroll = vi.fn().mockRejectedValue(apiError(409, 'ALREADY_EMPLOYEE', 'You are already an employee'));
    const refetch = vi.fn().mockResolvedValue(undefined);
    expect(await runEnroll({ enroll, refetch })).toEqual({ status: 'already' });
    expect(enroll).toHaveBeenCalledTimes(1);
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('reports any other error with the normalised message and does not refetch', async () => {
    const enroll = vi.fn().mockRejectedValue(apiError(403, 'FORBIDDEN', 'Missing required permission: hr:self_attendance'));
    const refetch = vi.fn();
    const out = await runEnroll({ enroll, refetch });
    expect(out.status).toBe('error');
    expect(out.status === 'error' && out.message).toContain('Missing required permission');
    expect(refetch).not.toHaveBeenCalled();
  });

  it('handles a network failure', async () => {
    const out = await runEnroll({ enroll: vi.fn().mockRejectedValue(new Error('boom')), refetch: vi.fn() });
    expect(out.status).toBe('error');
  });
});
