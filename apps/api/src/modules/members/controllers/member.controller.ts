import type { Request, Response } from 'express';

import { sendSuccess } from '../../../core/http/response';
import { actorFrom } from '../../authentication/utils/actor.util';
import type {
  AssignMembershipInput,
  AssignTrainerInput,
  CancelMembershipInput,
  CreateMemberInput,
  DowngradeMembershipInput,
  ExtendMembershipInput,
  FreezeMembershipInput,
  ListMembersQuery,
  MemberBulkImportRow,
  RenewMembershipInput,
  TransferBranchInput,
  UpdateMemberInput,
  UpgradeMembershipInput,
  UploadDocumentInput,
} from '../dto/member.dto';
import { MemberService } from '../services/member.service';

function serviceFor(req: Request): MemberService {
  return new MemberService(req.tenant!.id);
}

export class MemberController {
  async list(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await serviceFor(req).list(req.query as unknown as ListMembersQuery));
  }

  async getById(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await serviceFor(req).getById(req.params.id!));
  }

  async create(req: Request, res: Response): Promise<void> {
    const member = await serviceFor(req).create(req.body as CreateMemberInput, actorFrom(req));
    sendSuccess(res, member, 'Member created.', 201);
  }

  async update(req: Request, res: Response): Promise<void> {
    const member = await serviceFor(req).update(req.params.id!, req.body as UpdateMemberInput, actorFrom(req));
    sendSuccess(res, member, 'Member updated.');
  }

  async activate(req: Request, res: Response): Promise<void> {
    await serviceFor(req).activate(req.params.id!, actorFrom(req));
    sendSuccess(res, null, 'Member activated.');
  }

  async deactivate(req: Request, res: Response): Promise<void> {
    await serviceFor(req).deactivate(req.params.id!, actorFrom(req));
    sendSuccess(res, null, 'Member deactivated.');
  }

  async freeze(req: Request, res: Response): Promise<void> {
    await serviceFor(req).freeze(req.params.id!, req.body as FreezeMembershipInput, actorFrom(req));
    sendSuccess(res, null, 'Member frozen.');
  }

  async unfreeze(req: Request, res: Response): Promise<void> {
    await serviceFor(req).unfreeze(req.params.id!, actorFrom(req));
    sendSuccess(res, null, 'Member unfrozen.');
  }

  async softDelete(req: Request, res: Response): Promise<void> {
    await serviceFor(req).softDelete(req.params.id!, actorFrom(req));
    sendSuccess(res, null, 'Member deleted.');
  }

  async restore(req: Request, res: Response): Promise<void> {
    await serviceFor(req).restore(req.params.id!, actorFrom(req));
    sendSuccess(res, null, 'Member restored.');
  }

  async assignMembership(req: Request, res: Response): Promise<void> {
    const member = await serviceFor(req).assignMembership(req.params.id!, req.body as AssignMembershipInput, actorFrom(req));
    sendSuccess(res, member, 'Membership assigned.');
  }

  async renewMembership(req: Request, res: Response): Promise<void> {
    const member = await serviceFor(req).renewMembership(req.params.id!, req.body as RenewMembershipInput, actorFrom(req));
    sendSuccess(res, member, 'Membership renewed.');
  }

  async upgradeMembership(req: Request, res: Response): Promise<void> {
    const member = await serviceFor(req).upgradeMembership(req.params.id!, req.body as UpgradeMembershipInput, actorFrom(req));
    sendSuccess(res, member, 'Membership upgraded.');
  }

  async downgradeMembership(req: Request, res: Response): Promise<void> {
    const member = await serviceFor(req).downgradeMembership(req.params.id!, req.body as DowngradeMembershipInput, actorFrom(req));
    sendSuccess(res, member, 'Membership downgraded.');
  }

  async extendMembership(req: Request, res: Response): Promise<void> {
    const member = await serviceFor(req).extendMembership(req.params.id!, req.body as ExtendMembershipInput, actorFrom(req));
    sendSuccess(res, member, 'Membership extended.');
  }

  async cancelMembership(req: Request, res: Response): Promise<void> {
    const member = await serviceFor(req).cancelMembership(req.params.id!, req.body as CancelMembershipInput, actorFrom(req));
    sendSuccess(res, member, 'Membership cancelled.');
  }

  async resumeMembership(req: Request, res: Response): Promise<void> {
    await serviceFor(req).resumeMembership(req.params.id!, actorFrom(req));
    sendSuccess(res, null, 'Membership resumed.');
  }

  async transferBranch(req: Request, res: Response): Promise<void> {
    const member = await serviceFor(req).transferBranch(req.params.id!, req.body as TransferBranchInput, actorFrom(req));
    sendSuccess(res, member, 'Member transferred to new branch.');
  }

  async assignTrainer(req: Request, res: Response): Promise<void> {
    const member = await serviceFor(req).assignTrainer(req.params.id!, req.body as AssignTrainerInput, actorFrom(req));
    sendSuccess(res, member, 'Trainer assignment updated.');
  }

  async regenerateQrCode(req: Request, res: Response): Promise<void> {
    const result = await serviceFor(req).regenerateQrCode(req.params.id!, actorFrom(req));
    sendSuccess(res, result, 'QR code regenerated.');
  }

  async listDocuments(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await serviceFor(req).listDocuments(req.params.id!));
  }

  async uploadDocument(req: Request, res: Response): Promise<void> {
    const doc = await serviceFor(req).uploadDocument(req.params.id!, req.body as UploadDocumentInput, actorFrom(req));
    sendSuccess(res, doc, 'Document uploaded.', 201);
  }

  async deleteDocument(req: Request, res: Response): Promise<void> {
    await serviceFor(req).deleteDocument(req.params.id!, req.params.documentId!, actorFrom(req));
    sendSuccess(res, null, 'Document deleted.');
  }

  async exportCsv(req: Request, res: Response): Promise<void> {
    const csv = await serviceFor(req).exportCsv();
    res
      .status(200)
      .setHeader('Content-Type', 'text/csv; charset=utf-8')
      .setHeader('Content-Disposition', `attachment; filename="members-export-${new Date().toISOString().slice(0, 10)}.csv"`)
      .send(csv);
  }

  async bulkImport(req: Request, res: Response): Promise<void> {
    const { rows } = req.body as { rows: MemberBulkImportRow[] };
    const result = await serviceFor(req).bulkImport(rows, actorFrom(req));
    sendSuccess(res, result, `${result.created} member(s) imported.`, result.failed.length > 0 ? 207 : 201);
  }

  async bulkActivate(req: Request, res: Response): Promise<void> {
    const { memberIds } = req.body as { memberIds: string[] };
    const result = await serviceFor(req).bulkActivate(memberIds, actorFrom(req));
    sendSuccess(res, result, `${result.succeeded.length} member(s) activated.`);
  }

  async bulkDeactivate(req: Request, res: Response): Promise<void> {
    const { memberIds } = req.body as { memberIds: string[] };
    const result = await serviceFor(req).bulkDeactivate(memberIds, actorFrom(req));
    sendSuccess(res, result, `${result.succeeded.length} member(s) deactivated.`);
  }

  async bulkDelete(req: Request, res: Response): Promise<void> {
    const { memberIds } = req.body as { memberIds: string[] };
    const result = await serviceFor(req).bulkDelete(memberIds, actorFrom(req));
    sendSuccess(res, result, `${result.succeeded.length} member(s) deleted.`);
  }
}

export const memberController = new MemberController();
