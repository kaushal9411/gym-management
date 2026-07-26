import { ForbiddenError } from '../../../core/errors/app-error';
import { getBranchAccess } from '../../authentication/middlewares/branch-access.middleware';

/**
 * "Users can only access data for authorized branches" — every report/
 * analytics query goes through this before touching the DB. Returns a
 * Prisma-ready `branchId` where clause fragment: `undefined` (no filter,
 * user has all-branches access and didn't ask for one specific branch), a
 * single id, or `{ in: [...] }` when scoping to the user's allowed set.
 *
 * `userId` is optional — the scheduled-reports BullMQ job (a trusted system
 * context, not a live user request) calls this with no userId, since the
 * schedule's own `branchId` was already validated once against its
 * creator's access at `ScheduledReportService#create` time; re-validating
 * it here would need a *current* user to check against, which a background
 * job doesn't have, so a system caller's `requestedBranchId` is honored
 * verbatim instead of being re-checked.
 */
export async function resolveBranchScope(
  tenantId: string,
  userId: string | undefined,
  requestedBranchId: string | undefined,
): Promise<string | { in: string[] } | undefined> {
  if (!userId) return requestedBranchId;

  const access = await getBranchAccess(tenantId, userId);

  if (requestedBranchId) {
    if (!access.allBranches && !access.branchIds.includes(requestedBranchId)) {
      throw new ForbiddenError('You do not have access to reports for this branch.');
    }
    return requestedBranchId;
  }

  if (access.allBranches) return undefined;
  return { in: access.branchIds };
}
