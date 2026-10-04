import type { TenantStatus } from '@prisma/client';
import type { Request, Response } from 'express';

import { sendSuccess } from '../../../core/http/response';
import { adminTenantService } from '../services/admin-tenant.service';

interface ListQuery {
  search?: string;
  status?: TenantStatus;
  page: number;
  limit: number;
}

export class AdminTenantController {
  async list(req: Request, res: Response): Promise<void> {
    const result = await adminTenantService.list(req.query as unknown as ListQuery);
    sendSuccess(res, result);
  }

  async getById(req: Request, res: Response): Promise<void> {
    const tenant = await adminTenantService.getById(req.params.tenantId!);
    sendSuccess(res, tenant);
  }

  async activate(req: Request, res: Response): Promise<void> {
    await adminTenantService.setStatus(
      req.params.tenantId!,
      'ACTIVE',
      req.admin!.sub,
      req.admin!.role,
    );
    sendSuccess(res, null, 'Tenant activated.');
  }

  async suspend(req: Request, res: Response): Promise<void> {
    await adminTenantService.setStatus(
      req.params.tenantId!,
      'SUSPENDED',
      req.admin!.sub,
      req.admin!.role,
    );
    sendSuccess(res, null, 'Tenant suspended.');
  }

  async reactivate(req: Request, res: Response): Promise<void> {
    await adminTenantService.setStatus(
      req.params.tenantId!,
      'ACTIVE',
      req.admin!.sub,
      req.admin!.role,
    );
    sendSuccess(res, null, 'Tenant reactivated.');
  }

  async remove(req: Request, res: Response): Promise<void> {
    await adminTenantService.softDelete(req.params.tenantId!, req.admin!.sub, req.admin!.role);
    sendSuccess(res, null, 'Tenant deleted.');
  }

  async resetOwnerPassword(req: Request, res: Response): Promise<void> {
    const result = await adminTenantService.resetOwnerPassword(
      req.params.tenantId!,
      req.admin!.sub,
      req.admin!.role,
    );
    sendSuccess(res, result, 'Password reset email sent.');
  }

  async impersonate(req: Request, res: Response): Promise<void> {
    const result = await adminTenantService.impersonate(
      req.params.tenantId!,
      req.admin!.sub,
      req.admin!.role,
    );
    sendSuccess(res, result);
  }

  async extendTrial(req: Request, res: Response): Promise<void> {
    const result = await adminTenantService.extendTrial(
      req.params.tenantId!,
      req.body as { days: number; reason?: string },
      req.admin!.sub,
      req.admin!.role,
    );
    sendSuccess(res, result, 'Trial extended.');
  }

  async maintenance(req: Request, res: Response): Promise<void> {
    const body = req.body as { enabled: boolean; reason?: string };
    const result = await adminTenantService.setMaintenance(
      req.params.tenantId!,
      body,
      req.admin!.sub,
      req.admin!.role,
    );
    sendSuccess(
      res,
      result,
      body.enabled ? 'Maintenance mode enabled.' : 'Maintenance mode disabled.',
    );
  }

  async forceLogout(req: Request, res: Response): Promise<void> {
    const result = await adminTenantService.forceLogout(
      req.params.tenantId!,
      req.admin!.sub,
      req.admin!.role,
    );
    sendSuccess(res, result, 'All tenant sessions revoked.');
  }

  async subscription(req: Request, res: Response): Promise<void> {
    const result = await adminTenantService.subscription(req.params.tenantId!);
    sendSuccess(res, result);
  }

  async usage(req: Request, res: Response): Promise<void> {
    const result = await adminTenantService.usage(req.params.tenantId!);
    sendSuccess(res, result);
  }

  async auditLogs(req: Request, res: Response): Promise<void> {
    const result = await adminTenantService.auditLogs(req.params.tenantId!);
    sendSuccess(res, result);
  }
}

export const adminTenantController = new AdminTenantController();
