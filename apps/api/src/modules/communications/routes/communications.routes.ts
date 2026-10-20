import type { Request } from 'express';
import { Router } from 'express';

import { createRateLimiter } from '../../../core/middleware/rate-limiter';
import { validate } from '../../../core/middleware/validate.middleware';
import { authenticateMiddleware } from '../../authentication/middlewares/authenticate.middleware';
import { requirePermission } from '../../authentication/middlewares/authorize.middleware';
import { requireModuleEnabled } from '../../tenants/middleware/require-module-enabled.middleware';
import { communicationsController as c } from '../controllers/communications.controller';
import {
  audienceMembersQuerySchema,
  automationKeyParamSchema,
  createCampaignSchema,
  idParamSchema,
  listCampaignsQuerySchema,
  previewSchema,
  putAutomationSchema,
  recipientsQuerySchema,
  sendCampaignSchema,
  testAutomationSchema,
  testSendSchema,
  updateCampaignSchema,
} from '../validators/communications.validators';

export const communicationsRouter: Router = Router();

const asyncHandler =
  <T extends (req: never, res: never) => Promise<void>>(fn: T) =>
  (req: Parameters<T>[0], res: Parameters<T>[1], next: (err?: unknown) => void) => {
    Promise.resolve(fn(req, res)).catch(next);
  };

/** Per tenant + staff user (never IP alone - a front desk shares one). */
const perUser = (req: Request): string => `${req.tenant?.id ?? 'platform'}:${req.auth?.sub ?? req.ip}`;

/** Live audience counts fire on every filter tap, so this is generous. */
const readHeavyLimiter = () => createRateLimiter({ windowMs: 60_000, max: 120, prefix: 'comm-read', keyGenerator: perUser });
/** Create / edit / send / cancel / retry. The 10-campaigns-per-hour cap is enforced separately in the service. */
const writeLimiter = () => createRateLimiter({ windowMs: 10 * 60_000, max: 30, prefix: 'comm-write', keyGenerator: perUser });
const testLimiter = () => createRateLimiter({ windowMs: 60_000, max: 10, prefix: 'comm-test', keyGenerator: perUser });
const automationWriteLimiter = () => createRateLimiter({ windowMs: 10 * 60_000, max: 30, prefix: 'comm-automation', keyGenerator: perUser });

communicationsRouter.use(authenticateMiddleware);
communicationsRouter.use(requireModuleEnabled('notifications'));

/** @openapi { "/communications/overview": { get: { tags: [Communications], summary: "Hub - per-channel monthly quota, recent campaigns, automation count, quiet hours", security: [{bearerAuth: []}], responses: { 200: { description: "{ periodKey, channels[5], recent[], automations, quietHours }" } } } } } */
communicationsRouter.get('/overview', requirePermission('notifications:view'), asyncHandler(c.overview.bind(c)));

/** @openapi { "/communications/templates": { get: { tags: [Communications], summary: "The gym's active Notification templates as campaign starter text (notifications:send)", security: [{bearerAuth: []}], responses: { 200: { description: "{ items: [{ type, label, description, title, body, customized }] }" } } } } } */
communicationsRouter.get('/templates', requirePermission('notifications:send'), readHeavyLimiter(), asyncHandler(c.listTemplates.bind(c)));

/** @openapi { "/communications/audience/preview": { post: { tags: [Communications], summary: "Live audience count, sample names, per-channel contactable / opted-out / quota (notifications:send)", security: [{bearerAuth: []}], responses: { 200: { description: "{ total, sample, channels[], overLimit, largeSend, ... }" }, 404: { description: Unknown plan / branch / member }, 422: { description: Validation error } } } } } */
communicationsRouter.post('/audience/preview', requirePermission('notifications:send'), readHeavyLimiter(), validate({ body: previewSchema }), asyncHandler(c.preview.bind(c)));

/** @openapi { "/communications/audience/members": { get: { tags: [Communications], summary: "Member picker - search by name or member code (exact email / phone also match), branch-scoped, paginated (notifications:send)", security: [{bearerAuth: []}], parameters: [{in: query, name: search, schema: {type: string}}, {in: query, name: branchId, schema: {type: string}}, {in: query, name: page, schema: {type: integer}}, {in: query, name: limit, schema: {type: integer}}], responses: { 200: { description: "{ items[], page, limit, total, totalPages }" } } } } } */
communicationsRouter.get('/audience/members', requirePermission('notifications:send'), readHeavyLimiter(), validate({ query: audienceMembersQuerySchema }), asyncHandler(c.audienceMembers.bind(c)));

/** @openapi { "/communications/campaigns": { get: { tags: [Communications], summary: "Campaign history with status filter and per-status counts (notifications:view)", security: [{bearerAuth: []}], parameters: [{in: query, name: status, schema: {type: string}}, {in: query, name: search, schema: {type: string}}, {in: query, name: page, schema: {type: integer}}, {in: query, name: limit, schema: {type: integer}}], responses: { 200: { description: "{ items[], page, limit, total, totalPages, counts }" } } }, post: { tags: [Communications], summary: "Create a campaign and send now, schedule, or save as draft (notifications:send). Optional Idempotency-Key header.", security: [{bearerAuth: []}], responses: { 201: { description: Created }, 200: { description: Idempotent replay }, 409: { description: "QUOTA_EXCEEDED / CHANNEL_DISABLED / CONFIRMATION_REQUIRED" }, 422: { description: "VALIDATION_ERROR / AUDIENCE_EMPTY / RECIPIENT_LIMIT_EXCEEDED" }, 429: { description: "Over 10 campaigns per hour" } } } } } */
communicationsRouter.get('/campaigns', requirePermission('notifications:view'), validate({ query: listCampaignsQuerySchema }), asyncHandler(c.listCampaigns.bind(c)));
communicationsRouter.post('/campaigns', requirePermission('notifications:send'), writeLimiter(), validate({ body: createCampaignSchema }), asyncHandler(c.createCampaign.bind(c)));

/** @openapi { "/communications/campaigns/{id}": { get: { tags: [Communications], summary: "Campaign detail with per-channel breakdown, skip reasons, held messages (notifications:view)", security: [{bearerAuth: []}], parameters: [{in: path, name: id, required: true, schema: {type: string}}], responses: { 200: { description: OK }, 404: { description: Not found } } }, patch: { tags: [Communications], summary: "Edit a DRAFT or SCHEDULED campaign (notifications:send)", security: [{bearerAuth: []}], parameters: [{in: path, name: id, required: true, schema: {type: string}}], responses: { 200: { description: Updated }, 409: { description: INVALID_STATE } } } } } */
communicationsRouter.get('/campaigns/:id', requirePermission('notifications:view'), validate({ params: idParamSchema }), asyncHandler(c.getCampaign.bind(c)));
communicationsRouter.patch('/campaigns/:id', requirePermission('notifications:send'), writeLimiter(), validate({ params: idParamSchema, body: updateCampaignSchema }), asyncHandler(c.updateCampaign.bind(c)));

/** @openapi { "/communications/campaigns/{id}/recipients": { get: { tags: [Communications], summary: "Per-recipient results with status / channel / name filters (notifications:view)", security: [{bearerAuth: []}], parameters: [{in: path, name: id, required: true, schema: {type: string}}, {in: query, name: status, schema: {type: string}}, {in: query, name: channel, schema: {type: string}}, {in: query, name: search, schema: {type: string}}, {in: query, name: page, schema: {type: integer}}, {in: query, name: limit, schema: {type: integer}}], responses: { 200: { description: "{ items[], page, limit, total, totalPages }" } } } } } */
communicationsRouter.get('/campaigns/:id/recipients', requirePermission('notifications:view'), validate({ params: idParamSchema, query: recipientsQuerySchema }), asyncHandler(c.recipients.bind(c)));

/** @openapi { "/communications/campaigns/{id}/send": { post: { tags: [Communications], summary: "Start a DRAFT campaign now (notifications:send)", security: [{bearerAuth: []}], parameters: [{in: path, name: id, required: true, schema: {type: string}}], responses: { 200: { description: Sending }, 409: { description: "INVALID_STATE / QUOTA_EXCEEDED / CONFIRMATION_REQUIRED" } } } } } */
communicationsRouter.post('/campaigns/:id/send', requirePermission('notifications:send'), writeLimiter(), validate({ params: idParamSchema, body: sendCampaignSchema }), asyncHandler(c.sendCampaign.bind(c)));

/** @openapi { "/communications/campaigns/{id}/cancel": { post: { tags: [Communications], summary: "Cancel a DRAFT / SCHEDULED / SENDING campaign; queued messages become CANCELLED (notifications:send)", security: [{bearerAuth: []}], parameters: [{in: path, name: id, required: true, schema: {type: string}}], responses: { 200: { description: Cancelled }, 409: { description: INVALID_STATE } } } } } */
communicationsRouter.post('/campaigns/:id/cancel', requirePermission('notifications:send'), writeLimiter(), validate({ params: idParamSchema }), asyncHandler(c.cancelCampaign.bind(c)));

/** @openapi { "/communications/campaigns/{id}/retry-failed": { post: { tags: [Communications], summary: "Re-queue only the FAILED messages of a finished campaign (notifications:send)", security: [{bearerAuth: []}], parameters: [{in: path, name: id, required: true, schema: {type: string}}], responses: { 200: { description: "{ retried, campaign }" }, 409: { description: INVALID_STATE } } } } } */
communicationsRouter.post('/campaigns/:id/retry-failed', requirePermission('notifications:send'), writeLimiter(), validate({ params: idParamSchema }), asyncHandler(c.retryFailed.bind(c)));

/** @openapi { "/communications/test-send": { post: { tags: [Communications], summary: "Send a test of a message to the signed-in staff member's own email / phone / devices (notifications:send)", security: [{bearerAuth: []}], responses: { 200: { description: "{ results: [{channel, status, message}] }" }, 422: { description: Validation error } } } } } */
communicationsRouter.post('/test-send', requirePermission('notifications:send'), testLimiter(), validate({ body: testSendSchema }), asyncHandler(c.testSend.bind(c)));

/** @openapi { "/communications/automations": { get: { tags: [Communications], summary: "All nine automation rules merged with defaults, plus last-7-days sent counts (notifications:view)", security: [{bearerAuth: []}], responses: { 200: { description: "{ quietHours, items[9] }" } } } } } */
communicationsRouter.get('/automations', requirePermission('notifications:view'), asyncHandler(c.listAutomations.bind(c)));

/** @openapi { "/communications/automations/{key}": { put: { tags: [Communications], summary: "Save one automation rule - enabled, timings, channels, optional text override (notifications:manage)", security: [{bearerAuth: []}], parameters: [{in: path, name: key, required: true, schema: {type: string}}], responses: { 200: { description: "The saved rule" }, 422: { description: Validation error } } } } } */
communicationsRouter.put('/automations/:key', requirePermission('notifications:manage'), automationWriteLimiter(), validate({ params: automationKeyParamSchema, body: putAutomationSchema }), asyncHandler(c.putAutomation.bind(c)));

/** @openapi { "/communications/automations/{key}/test": { post: { tags: [Communications], summary: "Send the rule's current message (sample data) to your own contact (notifications:manage)", security: [{bearerAuth: []}], parameters: [{in: path, name: key, required: true, schema: {type: string}}], responses: { 200: { description: "{ results[] }" } } } } } */
communicationsRouter.post('/automations/:key/test', requirePermission('notifications:manage'), testLimiter(), validate({ params: automationKeyParamSchema, body: testAutomationSchema }), asyncHandler(c.testAutomation.bind(c)));
