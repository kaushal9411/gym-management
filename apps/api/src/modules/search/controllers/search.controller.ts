import type { Request, Response } from 'express';

import { sendSuccess } from '../../../core/http/response';
import { GlobalSearchService } from '../services/search.service';

export class SearchController {
  async search(req: Request, res: Response): Promise<void> {
    const service = new GlobalSearchService(req.tenant!.id);
    sendSuccess(res, await service.search(req.query.q as string, req.auth!.sub));
  }
}

export const searchController = new SearchController();
