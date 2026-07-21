import { Router } from 'express';

import { validate } from '../../../core/middleware/validate.middleware';
import { authenticateMiddleware } from '../../authentication/middlewares/authenticate.middleware';
import { requirePermission } from '../../authentication/middlewares/authorize.middleware';
import { staffController } from '../controllers/staff.controller';
import {
  acceptStaffActivationSchema,
  assignBranchesSchema,
  assignRoleSchema,
  bulkStaffActionSchema,
  createStaffSchema,
  listStaffQuerySchema,
  lookupStaffActivationQuerySchema,
  staffBulkImportSchema,
  staffIdParamSchema,
  updateStaffSchema,
} from '../validators/staff.validators';

export const staffRouter: Router = Router();

const asyncHandler =
  <T extends (req: never, res: never) => Promise<void>>(fn: T) =>
  (req: Parameters<T>[0], res: Parameters<T>[1], next: (err?: unknown) => void) => {
    Promise.resolve(fn(req, res)).catch(next);
  };

// ── Public (token is the credential — staff account already exists) ──────

/**
 * @openapi
 * /staff/activation/lookup:
 *   get:
 *     tags: [Staff]
 *     summary: Resolve a staff activation token (public — shown on the "set your password" page)
 *     parameters:
 *       - in: query
 *         name: token
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: "{ name, email, expiresAt }" }
 *       410: { description: Invalid or expired activation link }
 */
staffRouter.get(
  '/activation/lookup',
  validate({ query: lookupStaffActivationQuerySchema }),
  asyncHandler(staffController.lookupActivation.bind(staffController)),
);

/**
 * @openapi
 * /staff/activation/accept:
 *   post:
 *     tags: [Staff]
 *     summary: Set a password and activate a staff account (public)
 *     responses:
 *       201: { description: Account activated }
 *       410: { description: Invalid or expired activation link }
 */
staffRouter.post(
  '/activation/accept',
  validate({ body: acceptStaffActivationSchema }),
  asyncHandler(staffController.acceptActivation.bind(staffController)),
);

// ── Staff-facing management ───────────────────────────────────────────────

staffRouter.use(authenticateMiddleware);

/**
 * @openapi
 * /staff:
 *   get:
 *     tags: [Staff]
 *     summary: Paginated staff list (Managers/Trainers/Receptionists) with search + filters
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: "{ items, total, page, limit, totalPages }" }
 *   post:
 *     tags: [Staff]
 *     summary: Create a staff member — sends an activation email, respects subscription staff limits
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: Staff member created }
 *       409: { description: Duplicate email/phone/employee ID, or plan limit reached }
 */
staffRouter.get(
  '/',
  requirePermission('staff:view'),
  validate({ query: listStaffQuerySchema }),
  asyncHandler(staffController.list.bind(staffController)),
);
staffRouter.post(
  '/',
  requirePermission('staff:create'),
  validate({ body: createStaffSchema }),
  asyncHandler(staffController.create.bind(staffController)),
);

/** @openapi { "/staff/export": { get: { tags: [Staff], summary: Download the staff list as CSV, security: [{bearerAuth: []}], responses: { 200: { description: CSV file } } } } } */
staffRouter.get('/export', requirePermission('staff:view'), asyncHandler(staffController.exportCsv.bind(staffController)));

/** @openapi { "/staff/import": { post: { tags: [Staff], summary: Bulk-create staff from parsed CSV rows, security: [{bearerAuth: []}], responses: { 201: { description: All rows imported }, 207: { description: "Partial success - see failed[]" } } } } } */
staffRouter.post(
  '/import',
  requirePermission('staff:create'),
  validate({ body: staffBulkImportSchema }),
  asyncHandler(staffController.bulkImport.bind(staffController)),
);

/** @openapi { "/staff/bulk/activate": { post: { tags: [Staff], summary: Activate multiple staff members, security: [{bearerAuth: []}], responses: { 200: { description: "{ succeeded, failed }" } } } } } */
staffRouter.post(
  '/bulk/activate',
  requirePermission('staff:activate'),
  validate({ body: bulkStaffActionSchema }),
  asyncHandler(staffController.bulkActivate.bind(staffController)),
);

/** @openapi { "/staff/bulk/deactivate": { post: { tags: [Staff], summary: Deactivate multiple staff members, security: [{bearerAuth: []}], responses: { 200: { description: "{ succeeded, failed }" } } } } } */
staffRouter.post(
  '/bulk/deactivate',
  requirePermission('staff:activate'),
  validate({ body: bulkStaffActionSchema }),
  asyncHandler(staffController.bulkDeactivate.bind(staffController)),
);

/** @openapi { "/staff/bulk/delete": { post: { tags: [Staff], summary: Soft-delete multiple staff members, security: [{bearerAuth: []}], responses: { 200: { description: "{ succeeded, failed }" } } } } } */
staffRouter.post(
  '/bulk/delete',
  requirePermission('staff:delete'),
  validate({ body: bulkStaffActionSchema }),
  asyncHandler(staffController.bulkDelete.bind(staffController)),
);

/**
 * @openapi
 * /staff/{staffId}:
 *   get:
 *     tags: [Staff]
 *     summary: Full staff detail — profile, employment info, roles, branch access
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Staff detail }
 *   patch:
 *     tags: [Staff]
 *     summary: Update staff profile/employment fields
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Staff member updated }
 *   delete:
 *     tags: [Staff]
 *     summary: Soft-delete a staff member (restorable; sessions revoked)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Staff member deleted }
 */
staffRouter.get(
  '/:staffId',
  requirePermission('staff:view'),
  validate({ params: staffIdParamSchema }),
  asyncHandler(staffController.getById.bind(staffController)),
);
staffRouter.patch(
  '/:staffId',
  requirePermission('staff:update'),
  validate({ params: staffIdParamSchema, body: updateStaffSchema }),
  asyncHandler(staffController.update.bind(staffController)),
);
staffRouter.delete(
  '/:staffId',
  requirePermission('staff:delete'),
  validate({ params: staffIdParamSchema }),
  asyncHandler(staffController.softDelete.bind(staffController)),
);

/** @openapi { "/staff/{staffId}/activate": { post: { tags: [Staff], summary: Activate a suspended/deactivated staff account, security: [{bearerAuth: []}], responses: { 200: { description: Activated } } } } } */
staffRouter.post(
  '/:staffId/activate',
  requirePermission('staff:activate'),
  validate({ params: staffIdParamSchema }),
  asyncHandler(staffController.activate.bind(staffController)),
);

/** @openapi { "/staff/{staffId}/deactivate": { post: { tags: [Staff], summary: Deactivate a staff account, security: [{bearerAuth: []}], responses: { 200: { description: Deactivated } } } } } */
staffRouter.post(
  '/:staffId/deactivate',
  requirePermission('staff:activate'),
  validate({ params: staffIdParamSchema }),
  asyncHandler(staffController.deactivate.bind(staffController)),
);

/** @openapi { "/staff/{staffId}/suspend": { post: { tags: [Staff], summary: Suspend a staff account and revoke sessions, security: [{bearerAuth: []}], responses: { 200: { description: Suspended } } } } } */
staffRouter.post(
  '/:staffId/suspend',
  requirePermission('staff:activate'),
  validate({ params: staffIdParamSchema }),
  asyncHandler(staffController.suspend.bind(staffController)),
);

/** @openapi { "/staff/{staffId}/restore": { post: { tags: [Staff], summary: Restore a suspended/deactivated/deleted staff member, security: [{bearerAuth: []}], responses: { 200: { description: Restored } } } } } */
staffRouter.post(
  '/:staffId/restore',
  requirePermission('staff:restore'),
  validate({ params: staffIdParamSchema }),
  asyncHandler(staffController.restore.bind(staffController)),
);

/** @openapi { "/staff/{staffId}/reset-password": { post: { tags: [Staff], summary: Email the staff member a password-reset link, security: [{bearerAuth: []}], responses: { 200: { description: Reset email sent } } } } } */
staffRouter.post(
  '/:staffId/reset-password',
  requirePermission('staff:update'),
  validate({ params: staffIdParamSchema }),
  asyncHandler(staffController.resetPassword.bind(staffController)),
);

/** @openapi { "/staff/{staffId}/resend-activation": { post: { tags: [Staff], summary: Resend the activation email (only while PENDING_VERIFICATION), security: [{bearerAuth: []}], responses: { 200: { description: Resent } } } } } */
staffRouter.post(
  '/:staffId/resend-activation',
  requirePermission('staff:invite'),
  validate({ params: staffIdParamSchema }),
  asyncHandler(staffController.resendActivation.bind(staffController)),
);

/** @openapi { "/staff/{staffId}/branches": { put: { tags: [Staff], summary: Replace the staff member's branch assignments + primary branch, security: [{bearerAuth: []}], responses: { 200: { description: Branch assignments updated } } } } } */
staffRouter.put(
  '/:staffId/branches',
  requirePermission('staff:assign-branch'),
  validate({ params: staffIdParamSchema, body: assignBranchesSchema }),
  asyncHandler(staffController.assignBranches.bind(staffController)),
);

/** @openapi { "/staff/{staffId}/role": { put: { tags: [Staff], summary: Change the staff member's role, security: [{bearerAuth: []}], responses: { 200: { description: Role updated } } } } } */
staffRouter.put(
  '/:staffId/role',
  requirePermission('staff:assign-role'),
  validate({ params: staffIdParamSchema, body: assignRoleSchema }),
  asyncHandler(staffController.assignRole.bind(staffController)),
);
