import type { Request, Response } from 'express';

import { sendSuccess } from '../../../core/http/response';
import { tenantControlsService } from '../services/tenant-controls.service';
import { tenantDetailService } from '../services/tenant-detail.service';
import { tenantNotesService } from '../services/tenant-notes.service';
import { tenantReportsService } from '../services/tenant-reports.service';
import type { LimitKey } from '../utils/tenant-limits.util';
import type { ReportRange } from '../utils/tenant-reports.util';

const id = (req: Request) => req.params.tenantId!;
const admin = (req: Request) => req.admin!;

/** Thin HTTP layer — validation already ran in the router. */
export class TenantDetailController {
  async overview(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await tenantDetailService.overview(id(req)));
  }

  async reports(req: Request, res: Response): Promise<void> {
    const q = req.query as unknown as { range: ReportRange; compare: boolean };
    sendSuccess(res, await tenantReportsService.reports(id(req), q.range, q.compare));
  }

  async getLimits(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await tenantControlsService.getLimits(id(req)));
  }

  async putLimits(req: Request, res: Response): Promise<void> {
    const body = req.body as { overrides: Partial<Record<LimitKey, number | null>> };
    sendSuccess(
      res,
      await tenantControlsService.putLimits(id(req), body.overrides, admin(req)),
      'Limit overrides saved.',
    );
  }

  async getModules(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await tenantControlsService.getModules(id(req)));
  }

  async putModule(req: Request, res: Response): Promise<void> {
    const body = req.body as { enabled: boolean };
    sendSuccess(
      res,
      await tenantControlsService.setModule(id(req), req.params.key!, body.enabled, admin(req)),
      'Module updated.',
    );
  }

  async listNotes(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await tenantNotesService.listNotes(id(req), admin(req)));
  }

  async addNote(req: Request, res: Response): Promise<void> {
    const body = req.body as { body: string };
    sendSuccess(
      res,
      await tenantNotesService.addNote(id(req), body.body, admin(req)),
      'Note added.',
      201,
    );
  }

  async deleteNote(req: Request, res: Response): Promise<void> {
    await tenantNotesService.deleteNote(id(req), req.params.noteId!, admin(req));
    sendSuccess(res, null, 'Note deleted.');
  }

  async getTags(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await tenantNotesService.getTags(id(req)));
  }

  async putTags(req: Request, res: Response): Promise<void> {
    const body = req.body as { tags: string[] };
    sendSuccess(
      res,
      await tenantNotesService.setTags(id(req), body.tags, admin(req)),
      'Tags saved.',
    );
  }

  async users(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await tenantDetailService.users(id(req), req.query as never));
  }

  async activity(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await tenantDetailService.activity(id(req), req.query as never));
  }

  async tickets(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await tenantDetailService.tickets(id(req), req.query as never));
  }

  async subscriptionHistory(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await tenantDetailService.subscriptionHistory(id(req)));
  }
}

export const tenantDetailController = new TenantDetailController();
