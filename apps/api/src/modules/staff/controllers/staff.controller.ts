import type { Request, Response } from 'express';

import { sendSuccess } from '../../../core/http/response';
import { actorFrom } from '../../authentication/utils/actor.util';
import type {
  AssignBranchesInput,
  AssignRoleInput,
  CreateStaffInput,
  ListStaffQuery,
  StaffBulkImportRow,
  UpdateStaffInput,
} from '../dto/staff.dto';
import { StaffService } from '../services/staff.service';

function serviceFor(req: Request): StaffService {
  return new StaffService(req.tenant!.id);
}

export class StaffController {
  async list(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await serviceFor(req).list(req.query as unknown as ListStaffQuery));
  }

  async getById(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await serviceFor(req).getById(req.params.staffId!));
  }

  async create(req: Request, res: Response): Promise<void> {
    const staffMember = await serviceFor(req).create(req.body as CreateStaffInput, actorFrom(req));
    sendSuccess(res, staffMember, 'Staff member created — an activation email has been sent.', 201);
  }

  async update(req: Request, res: Response): Promise<void> {
    const staffMember = await serviceFor(req).update(req.params.staffId!, req.body as UpdateStaffInput, actorFrom(req));
    sendSuccess(res, staffMember, 'Staff member updated.');
  }

  async activate(req: Request, res: Response): Promise<void> {
    await serviceFor(req).activate(req.params.staffId!, actorFrom(req));
    sendSuccess(res, null, 'Staff member activated.');
  }

  async deactivate(req: Request, res: Response): Promise<void> {
    await serviceFor(req).deactivate(req.params.staffId!, actorFrom(req));
    sendSuccess(res, null, 'Staff member deactivated.');
  }

  async suspend(req: Request, res: Response): Promise<void> {
    await serviceFor(req).suspend(req.params.staffId!, actorFrom(req));
    sendSuccess(res, null, 'Staff member suspended.');
  }

  async softDelete(req: Request, res: Response): Promise<void> {
    await serviceFor(req).softDelete(req.params.staffId!, actorFrom(req));
    sendSuccess(res, null, 'Staff member deleted.');
  }

  async restore(req: Request, res: Response): Promise<void> {
    await serviceFor(req).restore(req.params.staffId!, actorFrom(req));
    sendSuccess(res, null, 'Staff member restored.');
  }

  async resetPassword(req: Request, res: Response): Promise<void> {
    await serviceFor(req).resetPassword(req.params.staffId!, actorFrom(req));
    sendSuccess(res, null, 'Password reset email sent.');
  }

  async resendActivation(req: Request, res: Response): Promise<void> {
    await serviceFor(req).resendActivation(req.params.staffId!, actorFrom(req));
    sendSuccess(res, null, 'Activation email resent.');
  }

  async assignBranches(req: Request, res: Response): Promise<void> {
    const staffMember = await serviceFor(req).assignBranches(
      req.params.staffId!,
      req.body as AssignBranchesInput,
      actorFrom(req),
    );
    sendSuccess(res, staffMember, 'Branch assignments updated.');
  }

  async assignRole(req: Request, res: Response): Promise<void> {
    const staffMember = await serviceFor(req).assignRole(req.params.staffId!, req.body as AssignRoleInput, actorFrom(req));
    sendSuccess(res, staffMember, 'Role updated.');
  }

  async exportCsv(req: Request, res: Response): Promise<void> {
    const csv = await serviceFor(req).exportCsv();
    res
      .status(200)
      .setHeader('Content-Type', 'text/csv; charset=utf-8')
      .setHeader('Content-Disposition', `attachment; filename="staff-export-${new Date().toISOString().slice(0, 10)}.csv"`)
      .send(csv);
  }

  async bulkImport(req: Request, res: Response): Promise<void> {
    const { rows } = req.body as { rows: StaffBulkImportRow[] };
    const result = await serviceFor(req).bulkImport(rows, actorFrom(req));
    sendSuccess(res, result, `${result.created} staff member(s) imported.`, result.failed.length > 0 ? 207 : 201);
  }

  async bulkActivate(req: Request, res: Response): Promise<void> {
    const { userIds } = req.body as { userIds: string[] };
    const result = await serviceFor(req).bulkActivate(userIds, actorFrom(req));
    sendSuccess(res, result, `${result.succeeded.length} staff member(s) activated.`);
  }

  async bulkDeactivate(req: Request, res: Response): Promise<void> {
    const { userIds } = req.body as { userIds: string[] };
    const result = await serviceFor(req).bulkDeactivate(userIds, actorFrom(req));
    sendSuccess(res, result, `${result.succeeded.length} staff member(s) deactivated.`);
  }

  async bulkDelete(req: Request, res: Response): Promise<void> {
    const { userIds } = req.body as { userIds: string[] };
    const result = await serviceFor(req).bulkDelete(userIds, actorFrom(req));
    sendSuccess(res, result, `${result.succeeded.length} staff member(s) deleted.`);
  }

  /** Public — invitee's browser resolves the activation link before showing the "set password" form. */
  async lookupActivation(req: Request, res: Response): Promise<void> {
    const { token } = req.query as { token: string };
    sendSuccess(res, await new StaffService(req.tenant!.id).lookupActivation(token));
  }

  /** Public — consumes the token, sets the password, and activates the account. */
  async acceptActivation(req: Request, res: Response): Promise<void> {
    const result = await new StaffService(req.tenant!.id).acceptActivation(
      req.body as { token: string; password: string },
    );
    sendSuccess(res, result, 'Account activated — you can sign in now.', 201);
  }
}

export const staffController = new StaffController();
