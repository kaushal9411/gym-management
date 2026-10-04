import type { Request, Response } from 'express';

import { sendSuccess } from '../../../core/http/response';
import { adminAuditLogRepository } from '../../admin-audit/repositories/admin-audit-log.repository';
import { getAdminPermissions } from '../../admin-auth/middlewares/admin-authorize.middleware';
import { tenantBulkService, type BulkParams } from '../services/tenant-bulk.service';
import { tenantListService, type ListParams } from '../services/tenant-list.service';
import { CSV_HEADERS, csvRow, tenantCsvRow } from '../utils/tenant-list.util';
import type { BulkAction } from '../validators/tenant-list.validators';

export class TenantListController {
  async list(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await tenantListService.list(req.query as unknown as ListParams));
  }

  async tags(_req: Request, res: Response): Promise<void> {
    sendSuccess(res, await tenantListService.tags());
  }

  async insights(_req: Request, res: Response): Promise<void> {
    sendSuccess(res, await tenantListService.insights());
  }

  async bulk(req: Request, res: Response): Promise<void> {
    const body = req.body as { action: BulkAction; tenantIds: string[]; params: BulkParams };
    const permissions = await getAdminPermissions(req.admin!);
    const result = await tenantBulkService.run(body, {
      sub: req.admin!.sub,
      role: req.admin!.role,
      permissions,
    });
    sendSuccess(
      res,
      result,
      `Bulk action finished: ${result.succeeded} succeeded, ${result.failed} failed.`,
    );
  }

  async export(req: Request, res: Response): Promise<void> {
    const { rows, total, tags } = await tenantListService.exportRows(
      req.query as unknown as Omit<ListParams, 'page' | 'limit'>,
    );
    await adminAuditLogRepository.record({
      adminUserId: req.admin!.sub,
      actorRole: req.admin!.role,
      action: 'admin.tenants_exported',
      entityType: 'Tenant',
      after: { rows: rows.length, matched: total },
    });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="tenants-${new Date().toISOString().slice(0, 10)}.csv"`,
    );
    res.write(csvRow([...CSV_HEADERS]));
    for (let i = 0; i < rows.length; i += 250) {
      res.write(
        rows
          .slice(i, i + 250)
          .map((r) => tenantCsvRow(r, tags.get(r.id) ?? []))
          .join(''),
      );
    }
    res.end();
  }
}

export const tenantListController = new TenantListController();
