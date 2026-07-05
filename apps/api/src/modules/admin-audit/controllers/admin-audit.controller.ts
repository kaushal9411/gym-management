import type { Request, Response } from 'express';

import { sendSuccess } from '../../../core/http/response';
import { adminAuditLogRepository } from '../repositories/admin-audit-log.repository';

export class AdminAuditController {
  async list(req: Request, res: Response): Promise<void> {
    const page = req.query.page ? Number(req.query.page) : 1;
    const limit = req.query.limit ? Math.min(Number(req.query.limit), 100) : 20;
    const { total, items } = await adminAuditLogRepository.list({ action: req.query.action as string | undefined, skip: (page - 1) * limit, take: limit });
    sendSuccess(res, { items, page, limit, total, totalPages: Math.ceil(total / limit) });
  }
}

export const adminAuditController = new AdminAuditController();
