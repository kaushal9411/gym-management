import { toAuthServiceError } from '@/features/auth/services/api-client';

export type EnrollOutcome = { status: 'enrolled' } | { status: 'already' } | { status: 'error'; message: string };

/** The card is only for users who hold a self key AND were told they have no employee profile. */
export function shouldShowEnrollCard(hasSelfKeys: boolean, errorCode: string | undefined): boolean {
  return hasSelfKeys && errorCode === 'NOT_AN_EMPLOYEE';
}

/**
 * One enrolment attempt. `ALREADY_EMPLOYEE` (409) means someone (another tab, another admin) got there first, so the
 * right reaction is simply to refetch and show the normal My HR; any other failure is reported as a message.
 */
export async function runEnroll(deps: { enroll: () => Promise<unknown>; refetch: () => unknown }): Promise<EnrollOutcome> {
  try {
    await deps.enroll();
    return { status: 'enrolled' };
  } catch (e) {
    const err = toAuthServiceError(e);
    if (err.details?.apiCode === 'ALREADY_EMPLOYEE') {
      await deps.refetch();
      return { status: 'already' };
    }
    return { status: 'error', message: err.message };
  }
}
