import { Router } from 'express';

import { sendSuccess } from '../../../core/http/response';
import { validate } from '../../../core/middleware/validate.middleware';
import { adminCmsService } from '../services/admin-cms.service';
import { publicCmsPageQuerySchema } from '../validators/admin-cms.validators';

export const publicCmsRouter: Router = Router();

/**
 * No auth at all, deliberately (Prompt 81) — `CmsPage` is platform-wide, not
 * tenant-scoped (legal pages, marketing FAQ), and the two real consumers —
 * the registration form's Terms/Privacy links and the tenant Help Center's
 * FAQ list — both need to render this before/without any session existing.
 * Same "mirrors the existing /public/tenants precedent" reasoning as
 * `public-app-release.routes.ts`. Only ever returns `isPublished` rows —
 * see `AdminCmsService#listPublished`.
 */

/** @openapi { "/public/cms/pages": { get: { tags: [Authentication], summary: "Published CMS pages of one type (FAQ/TERMS/PRIVACY/COOKIE/LANDING/BLOG/TESTIMONIAL) — no auth required, drafts never included", responses: { 200: { description: "CmsPage[]" } } } } } */
publicCmsRouter.get('/pages', validate({ query: publicCmsPageQuerySchema }), async (req, res, next) => {
  try {
    const { type } = req.query as unknown as { type: Parameters<typeof adminCmsService.listPublished>[0] };
    const pages = await adminCmsService.listPublished(type);
    sendSuccess(res, pages);
  } catch (error) {
    next(error);
  }
});
