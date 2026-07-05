import type { CmsPageType } from '@prisma/client';
import type { Request, Response } from 'express';

import { sendSuccess } from '../../../core/http/response';
import { adminCmsService, type UpsertCmsPageInput } from '../services/admin-cms.service';

type ParamsDictionary = Record<string, string>;
type TypedBodyRequest<Body> = Request<ParamsDictionary, unknown, Body>;

export class AdminCmsController {
  async list(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await adminCmsService.list(req.query.type as CmsPageType | undefined));
  }

  async getBySlug(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await adminCmsService.getBySlug(req.params.slug!));
  }

  async create(req: TypedBodyRequest<UpsertCmsPageInput>, res: Response): Promise<void> {
    const page = await adminCmsService.create(req.body, req.admin!.sub, req.admin!.role);
    sendSuccess(res, page, 'Page created.', 201);
  }

  async update(req: TypedBodyRequest<Partial<UpsertCmsPageInput>>, res: Response): Promise<void> {
    const page = await adminCmsService.update(req.params.slug!, req.body, req.admin!.sub, req.admin!.role);
    sendSuccess(res, page, 'Page updated.');
  }

  async remove(req: Request, res: Response): Promise<void> {
    await adminCmsService.remove(req.params.slug!, req.admin!.sub, req.admin!.role);
    sendSuccess(res, null, 'Page deleted.');
  }
}

export const adminCmsController = new AdminCmsController();
