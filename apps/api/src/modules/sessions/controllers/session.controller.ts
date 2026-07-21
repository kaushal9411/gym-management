import type { Request, Response } from 'express';

import { sendSuccess } from '../../../core/http/response';
import { getTenantScopedClient } from '../../../infrastructure/database/tenant-scoped-client';
import { LoginHistoryQueryRepository } from '../repositories/login-history.repository';

/**
 * Active-session listing/revocation already lives in the authentication
 * module (GET/DELETE /auth/sessions, POST /auth/logout-all) — this module
 * only adds what was missing: the user's own login history.
 */
export class SessionController {
  async loginHistory(req: Request, res: Response): Promise<void> {
    const repository = new LoginHistoryQueryRepository(getTenantScopedClient(req.tenant!.id));
    const { page, limit } = req.query as unknown as { page: number; limit: number };
    const { items, total } = await repository.listForUser(req.tenant!.id, req.auth!.sub, { page, limit });
    sendSuccess(res, {
      items: items.map((h) => ({
        id: h.id,
        success: h.success,
        reason: h.reason,
        ipAddress: h.ipAddress,
        userAgent: h.userAgent,
        createdAt: h.createdAt.toISOString(),
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  }
}

export const sessionController = new SessionController();
