import { Router } from 'express';

import { validate } from '../../../core/middleware/validate.middleware';
import { requireAdminPermission } from '../../admin-auth/middlewares/admin-authorize.middleware';
import { tenantListController } from '../controllers/tenant-list.controller';
import {
  tenantBulkBodySchema,
  tenantExportQuerySchema,
  tenantListQuerySchema,
} from '../validators/tenant-list.validators';

/** Mounted by `admin-tenant.routes.ts` BEFORE its `/:tenantId` routes (so `insights`/`export`/`bulk` are never read as a tenant id). Auth is applied by the parent router. */
export const adminTenantListRouter: Router = Router();

const asyncHandler =
  <T extends (req: never, res: never) => Promise<void>>(fn: T) =>
  (req: Parameters<T>[0], res: Parameters<T>[1], next: (err?: unknown) => void) => {
    Promise.resolve(fn(req, res)).catch(next);
  };

/**
 * @openapi
 * /admin/tenants:
 *   get:
 *     tags: [Admin Tenants]
 *     summary: List All Tenants — search (name/slug/owner email), filters, saved views, sort, paginated, with tenant-wide counts and per-tenant health
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: search, schema: { type: string } }
 *       - { in: query, name: status, schema: { type: string, enum: [TRIAL, ACTIVE, PAST_DUE, SUSPENDED, CANCELLED] } }
 *       - { in: query, name: plan, description: plan id or name, schema: { type: string } }
 *       - { in: query, name: country, schema: { type: string } }
 *       - { in: query, name: createdFrom, schema: { type: string, format: date } }
 *       - { in: query, name: createdTo, schema: { type: string, format: date } }
 *       - { in: query, name: health, schema: { type: string, enum: [at_risk, fair, healthy] } }
 *       - { in: query, name: tag, description: single admin tag slug, schema: { type: string } }
 *       - { in: query, name: view, schema: { type: string, enum: [trials_ending, at_risk, past_due, suspended, near_limits] } }
 *       - { in: query, name: sort, schema: { type: string, enum: [mrr, createdAt, lastActiveAt, members, health, name] } }
 *       - { in: query, name: sortDir, schema: { type: string, enum: [asc, desc] } }
 *       - { in: query, name: page, schema: { type: integer, default: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, default: 20, maximum: 100 } }
 *     responses:
 *       200: { description: "{ items, page, limit, total, totalPages, counts }" }
 */
adminTenantListRouter.get(
  '/',
  requireAdminPermission('tenants:read'),
  validate({ query: tenantListQuerySchema }),
  asyncHandler(tenantListController.list.bind(tenantListController)),
);

/**
 * @openapi
 * /admin/tenants/insights:
 *   get:
 *     tags: [Admin Tenants]
 *     summary: "Tenants page insight cards — growth, plan mix, health distribution, signups by source (null: not stored), renewals"
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: "{ growth, planMix, healthDistribution, signupsBySource, renewals }" }
 */
adminTenantListRouter.get(
  '/insights',
  requireAdminPermission('tenants:read'),
  asyncHandler(tenantListController.insights.bind(tenantListController)),
);

/**
 * @openapi
 * /admin/tenants/tags:
 *   get:
 *     tags: [Admin Tenants]
 *     summary: Distinct admin tags in use on live tenants, with tenant counts (for the tag filter)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: "[{ tag, count }]" }
 */
adminTenantListRouter.get(
  '/tags',
  requireAdminPermission('tenants:read'),
  asyncHandler(tenantListController.tags.bind(tenantListController)),
);

/**
 * @openapi
 * /admin/tenants/export:
 *   get:
 *     tags: [Admin Tenants]
 *     summary: Export tenants as CSV (same filters as the list; 5,000-row cap; formula-injection safe)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: search, schema: { type: string } }
 *       - { in: query, name: status, schema: { type: string } }
 *       - { in: query, name: plan, schema: { type: string } }
 *       - { in: query, name: country, schema: { type: string } }
 *       - { in: query, name: createdFrom, schema: { type: string, format: date } }
 *       - { in: query, name: createdTo, schema: { type: string, format: date } }
 *       - { in: query, name: health, schema: { type: string } }
 *       - { in: query, name: tag, schema: { type: string } }
 *       - { in: query, name: view, schema: { type: string } }
 *       - { in: query, name: sort, schema: { type: string } }
 *       - { in: query, name: sortDir, schema: { type: string } }
 *     responses:
 *       200: { description: text/csv attachment }
 */
adminTenantListRouter.get(
  '/export',
  requireAdminPermission('tenants:read'),
  validate({ query: tenantExportQuerySchema }),
  asyncHandler(tenantListController.export.bind(tenantListController)),
);

/**
 * @openapi
 * /admin/tenants/bulk:
 *   post:
 *     tags: [Admin Tenants]
 *     summary: Bulk tenant action — runs the existing single-tenant function per tenant, continues past failures (change-plan also needs payments:manage; no bulk delete)
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [action, tenantIds]
 *             properties:
 *               action: { type: string, enum: [extend-trial, change-plan, maintenance, suspend, reactivate, force-logout] }
 *               tenantIds: { type: array, minItems: 1, maxItems: 100, items: { type: string, format: uuid } }
 *               params:
 *                 type: object
 *                 properties:
 *                   days: { type: integer, minimum: 1, maximum: 90 }
 *                   reason: { type: string, maxLength: 200 }
 *                   planId: { type: string, format: uuid }
 *                   mode: { type: string, enum: [manual, payment_link] }
 *                   enabled: { type: boolean }
 *     responses:
 *       200: { description: "{ results: [{ tenantId, ok, error? }], succeeded, failed }" }
 *       403: { description: Missing permission }
 *       422: { description: Invalid body }
 */
adminTenantListRouter.post(
  '/bulk',
  requireAdminPermission('tenants:manage'),
  validate({ body: tenantBulkBodySchema }),
  asyncHandler(tenantListController.bulk.bind(tenantListController)),
);
