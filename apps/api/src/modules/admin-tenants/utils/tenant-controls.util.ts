import { AppError } from '../../../core/errors/app-error';
import { ErrorCode } from '../../../core/errors/error-codes';

const DAY_MS = 86_400_000;

/** New trial end = `days` after the LATER of now / the current trial end (extending a lapsed trial restarts from now). */
export function computeExtendedTrialEnd(
  current: Date | null,
  days: number,
  now: Date = new Date(),
): Date {
  const base = current && current.getTime() > now.getTime() ? current : now;
  return new Date(base.getTime() + days * DAY_MS);
}

/** Only tenants currently in TRIAL (and not deleted) can have their trial extended — 422 otherwise. */
export function assertTrialExtendable(tenant: { status: string; deletedAt: Date | null }): void {
  if (tenant.deletedAt) throw new AppError(ErrorCode.NOT_FOUND, 'Tenant not found', 404);
  if (tenant.status !== 'TRIAL') {
    throw new AppError(
      ErrorCode.VALIDATION_ERROR,
      `Only tenants on a free trial can be extended — this tenant is ${tenant.status}.`,
      422,
    );
  }
}

/** Idempotency guard: toggling to the state it is already in is a 409 so the UI can say so. */
export function assertMaintenanceChange(current: boolean, enabled: boolean): void {
  if (current === enabled) {
    throw new AppError(
      ErrorCode.CONFLICT,
      `Maintenance mode is already ${enabled ? 'on' : 'off'} for this tenant.`,
      409,
    );
  }
}
