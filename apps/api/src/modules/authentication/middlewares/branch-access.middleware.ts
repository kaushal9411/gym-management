import type { NextFunction, Request, Response } from 'express';

import { ForbiddenError, UnauthenticatedError } from '../../../core/errors/app-error';
import { getTenantScopedClient } from '../../../infrastructure/database/tenant-scoped-client';

export interface BranchAccess {
  allBranches: boolean;
  branchIds: string[];
  primaryBranchId: string | null;
}

/**
 * The user's branch scope: blanket access (allBranches) or the unexpired
 * rows in user_branches. Future modules (Members, Attendance, …) call this
 * to scope their queries; the middleware below guards single-branch routes.
 */
export async function getBranchAccess(tenantId: string, userId: string): Promise<BranchAccess> {
  const db = getTenantScopedClient(tenantId);
  const user = await db.user.findFirst({
    where: { id: userId, tenantId },
    select: {
      allBranches: true,
      userBranches: {
        where: { OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
        select: { branchId: true, isPrimary: true },
      },
    },
  });
  if (!user) return { allBranches: false, branchIds: [], primaryBranchId: null };
  return {
    allBranches: user.allBranches,
    branchIds: user.userBranches.map((ub) => ub.branchId),
    primaryBranchId: user.userBranches.find((ub) => ub.isPrimary)?.branchId ?? null,
  };
}

/**
 * Guards routes that operate on ONE branch (params/query/body `branchId`).
 * Requests without a branchId pass through — list endpoints scope their
 * own queries via getBranchAccess instead.
 */
export function requireBranchAccess(paramName = 'branchId') {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.auth || !req.tenant) throw new UnauthenticatedError();

      const branchId =
        (req.params[paramName] as string | undefined) ??
        (req.query[paramName] as string | undefined) ??
        ((req.body as Record<string, unknown> | undefined)?.[paramName] as string | undefined);
      if (!branchId) return next();

      const access = await getBranchAccess(req.tenant.id, req.auth.sub);
      if (!access.allBranches && !access.branchIds.includes(branchId)) {
        throw new ForbiddenError('You do not have access to this branch.');
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}
