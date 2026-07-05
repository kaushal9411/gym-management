import type { Request, Response } from 'express';

import { sendSuccess } from '../../../core/http/response';
import { prisma } from '../../../infrastructure/database/prisma';

export class AnnouncementController {
  /** Active announcements targeting this tenant — `ALL` always match; `TRIAL`/`ACTIVE` match the tenant's current status. */
  async listActive(req: Request, res: Response): Promise<void> {
    const tenantStatus = req.tenant!.status;
    const audienceMatch = tenantStatus === 'TRIAL' ? (['ALL', 'TRIAL'] as const) : tenantStatus === 'ACTIVE' ? (['ALL', 'ACTIVE'] as const) : (['ALL'] as const);

    const announcements = await prisma.announcement.findMany({
      where: {
        isActive: true,
        audience: { in: [...audienceMatch] },
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      orderBy: { publishedAt: 'desc' },
      take: 10,
    });

    sendSuccess(res, announcements);
  }
}

export const announcementController = new AnnouncementController();
