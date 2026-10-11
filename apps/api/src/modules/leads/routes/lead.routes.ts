import { Router } from 'express';

import { validate } from '../../../core/middleware/validate.middleware';
import { authenticateMiddleware } from '../../authentication/middlewares/authenticate.middleware';
import { requirePermission } from '../../authentication/middlewares/authorize.middleware';
import { leadController as c } from '../controllers/lead.controller';
import {
  addActivitySchema,
  assignLeadSchema,
  changeStatusSchema,
  convertLeadSchema,
  createLeadSchema,
  exportLeadsQuerySchema,
  followUpsQuerySchema,
  idParamSchema,
  leadAnalyticsQuerySchema,
  listLeadsQuerySchema,
  updateLeadSchema,
} from '../validators/lead.validators';

export const leadRouter: Router = Router();

const asyncHandler =
  <T extends (req: never, res: never) => Promise<void>>(fn: T) =>
  (req: Parameters<T>[0], res: Parameters<T>[1], next: (err?: unknown) => void) => {
    Promise.resolve(fn(req, res)).catch(next);
  };

leadRouter.use(authenticateMiddleware);

// NOTE: the fixed paths below MUST stay registered before `/:id`.

/** @openapi { "/leads/export": { get: { tags: [Leads], summary: "Download the filtered leads as CSV (formula-injection safe, audited)", security: [{bearerAuth: []}], responses: { 200: { description: CSV file } } } } } */
leadRouter.get('/export', requirePermission('leads:export'), validate({ query: exportLeadsQuerySchema }), asyncHandler(c.exportCsv.bind(c)));

/** @openapi { "/leads/analytics": { get: { tags: [Leads], summary: "Lead analytics for today|7d|30d|month|year|custom vs the preceding equal-length range", security: [{bearerAuth: []}], responses: { 200: { description: "{ range, previousRange, kpis, headline, daily, monthly, funnel, bySource, byStaff, byPlan, lostReasons, ageing, topBranches }" } } } } } */
leadRouter.get('/analytics', requirePermission('leads:view'), validate({ query: leadAnalyticsQuerySchema }), asyncHandler(c.analytics.bind(c)));

/** @openapi { "/leads/follow-ups": { get: { tags: [Leads], summary: "Due / overdue follow-ups for the dashboard widget (scope=mine|all)", security: [{bearerAuth: []}], responses: { 200: { description: "{ items, counts }" } } } } } */
leadRouter.get('/follow-ups', requirePermission('leads:view'), validate({ query: followUpsQuerySchema }), asyncHandler(c.followUps.bind(c)));

/** @openapi { "/leads/assignees": { get: { tags: [Leads], summary: "Active staff a lead can be assigned to", security: [{bearerAuth: []}], responses: { 200: { description: "{ id, name, role }[]" } } } } } */
leadRouter.get('/assignees', requirePermission('leads:view'), asyncHandler(c.assignees.bind(c)));

/**
 * @openapi
 * /leads:
 *   get:
 *     tags: [Leads]
 *     summary: Paginated leads with search + filters; adds per-status counts (ignoring the status filter) and a summary
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: "{ items, total, page, limit, totalPages, counts, summary }" }
 */
leadRouter.get('/', requirePermission('leads:view'), validate({ query: listLeadsQuerySchema }), asyncHandler(c.list.bind(c)));

/** @openapi { "/leads": { post: { tags: [Leads], summary: "Create a lead (409 with the matching record on a duplicate phone/email)", security: [{bearerAuth: []}], responses: { 201: { description: Lead created } } } } } */
leadRouter.post('/', requirePermission('leads:create'), validate({ body: createLeadSchema }), asyncHandler(c.create.bind(c)));

/** @openapi { "/leads/{id}": { get: { tags: [Leads], summary: "Lead detail with activity timeline", security: [{bearerAuth: []}], responses: { 200: { description: Lead } } } } } */
leadRouter.get('/:id', requirePermission('leads:view'), validate({ params: idParamSchema }), asyncHandler(c.getById.bind(c)));

/** @openapi { "/leads/{id}": { patch: { tags: [Leads], summary: "Edit a lead", security: [{bearerAuth: []}], responses: { 200: { description: Lead updated } } } } } */
leadRouter.patch('/:id', requirePermission('leads:update'), validate({ params: idParamSchema, body: updateLeadSchema }), asyncHandler(c.update.bind(c)));

/** @openapi { "/leads/{id}": { delete: { tags: [Leads], summary: "Soft-delete a lead", security: [{bearerAuth: []}], responses: { 200: { description: Lead deleted } } } } } */
leadRouter.delete('/:id', requirePermission('leads:delete'), validate({ params: idParamSchema }), asyncHandler(c.softDelete.bind(c)));

/** @openapi { "/leads/{id}/status": { patch: { tags: [Leads], summary: "Change a lead's status (LOST needs lostReason; CONVERTED only via /convert)", security: [{bearerAuth: []}], responses: { 200: { description: Lead updated } } } } } */
leadRouter.patch('/:id/status', requirePermission('leads:update'), validate({ params: idParamSchema, body: changeStatusSchema }), asyncHandler(c.changeStatus.bind(c)));

/** @openapi { "/leads/{id}/assign": { patch: { tags: [Leads], summary: "Assign / unassign a lead", security: [{bearerAuth: []}], responses: { 200: { description: Lead updated } } } } } */
leadRouter.patch('/:id/assign', requirePermission('leads:assign'), validate({ params: idParamSchema, body: assignLeadSchema }), asyncHandler(c.assign.bind(c)));

/** @openapi { "/leads/{id}/activities": { post: { tags: [Leads], summary: "Log a note / call / WhatsApp / email / visit / trial / follow-up; optional nextFollowUpAt", security: [{bearerAuth: []}], responses: { 201: { description: Lead with refreshed timeline } } } } } */
leadRouter.post('/:id/activities', requirePermission('leads:update'), validate({ params: idParamSchema, body: addActivitySchema }), asyncHandler(c.addActivity.bind(c)));

/** @openapi { "/leads/{id}/convert": { post: { tags: [Leads], summary: "Convert the lead into a member (reuses the member creation service; optional plan assignment)", security: [{bearerAuth: []}], responses: { 200: { description: "{ lead, member }" } } } } } */
leadRouter.post('/:id/convert', requirePermission('leads:convert'), validate({ params: idParamSchema, body: convertLeadSchema }), asyncHandler(c.convert.bind(c)));
