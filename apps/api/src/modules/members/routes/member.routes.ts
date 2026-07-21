import { Router } from 'express';

import { validate } from '../../../core/middleware/validate.middleware';
import { authenticateMiddleware } from '../../authentication/middlewares/authenticate.middleware';
import { requirePermission } from '../../authentication/middlewares/authorize.middleware';
import { memberController } from '../controllers/member.controller';
import {
  assignMembershipSchema,
  assignTrainerSchema,
  bulkMemberActionSchema,
  cancelMembershipSchema,
  createMemberSchema,
  downgradeMembershipSchema,
  extendMembershipSchema,
  freezeMembershipSchema,
  listMembersQuerySchema,
  memberBulkImportSchema,
  memberDocumentParamSchema,
  memberParamSchema,
  renewMembershipSchema,
  transferBranchSchema,
  updateMemberSchema,
  upgradeMembershipSchema,
  uploadMemberDocumentSchema,
} from '../validators/member.validators';

export const memberRouter: Router = Router();

const asyncHandler =
  <T extends (req: never, res: never) => Promise<void>>(fn: T) =>
  (req: Parameters<T>[0], res: Parameters<T>[1], next: (err?: unknown) => void) => {
    Promise.resolve(fn(req, res)).catch(next);
  };

memberRouter.use(authenticateMiddleware);

/**
 * @openapi
 * /members:
 *   get:
 *     tags: [Members]
 *     summary: Paginated member list with search + filters (status, branch, trainer, membership status)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: "{ items, total, page, limit, totalPages }" }
 *   post:
 *     tags: [Members]
 *     summary: Create a member — auto-generates Member ID and QR code, respects subscription member limits
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: Member created }
 *       409: { description: Duplicate email/phone/member ID, or plan limit reached }
 */
memberRouter.get(
  '/',
  requirePermission('members:view'),
  validate({ query: listMembersQuerySchema }),
  asyncHandler(memberController.list.bind(memberController)),
);
memberRouter.post(
  '/',
  requirePermission('members:create'),
  validate({ body: createMemberSchema }),
  asyncHandler(memberController.create.bind(memberController)),
);

/** @openapi { "/members/export": { get: { tags: [Members], summary: Download the member list as CSV, security: [{bearerAuth: []}], responses: { 200: { description: CSV file } } } } } */
memberRouter.get('/export', requirePermission('members:export'), asyncHandler(memberController.exportCsv.bind(memberController)));

/** @openapi { "/members/import": { post: { tags: [Members], summary: Bulk-create members from parsed CSV rows, security: [{bearerAuth: []}], responses: { 201: { description: All rows imported }, 207: { description: "Partial success - see failed[]" } } } } } */
memberRouter.post(
  '/import',
  requirePermission('members:import'),
  validate({ body: memberBulkImportSchema }),
  asyncHandler(memberController.bulkImport.bind(memberController)),
);

/** @openapi { "/members/bulk/activate": { post: { tags: [Members], summary: Activate multiple members, security: [{bearerAuth: []}], responses: { 200: { description: "{ succeeded, failed }" } } } } } */
memberRouter.post(
  '/bulk/activate',
  requirePermission('members:update'),
  validate({ body: bulkMemberActionSchema }),
  asyncHandler(memberController.bulkActivate.bind(memberController)),
);

/** @openapi { "/members/bulk/deactivate": { post: { tags: [Members], summary: Deactivate multiple members, security: [{bearerAuth: []}], responses: { 200: { description: "{ succeeded, failed }" } } } } } */
memberRouter.post(
  '/bulk/deactivate',
  requirePermission('members:update'),
  validate({ body: bulkMemberActionSchema }),
  asyncHandler(memberController.bulkDeactivate.bind(memberController)),
);

/** @openapi { "/members/bulk/delete": { post: { tags: [Members], summary: Soft-delete multiple members, security: [{bearerAuth: []}], responses: { 200: { description: "{ succeeded, failed }" } } } } } */
memberRouter.post(
  '/bulk/delete',
  requirePermission('members:delete'),
  validate({ body: bulkMemberActionSchema }),
  asyncHandler(memberController.bulkDelete.bind(memberController)),
);

/**
 * @openapi
 * /members/{id}:
 *   get:
 *     tags: [Members]
 *     summary: Full member detail — profile, membership history, freeze history, QR code
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Member detail }
 *   patch:
 *     tags: [Members]
 *     summary: Update member profile/medical/address fields
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Member updated }
 *   delete:
 *     tags: [Members]
 *     summary: Soft-delete a member (restorable)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Member deleted }
 */
memberRouter.get(
  '/:id',
  requirePermission('members:view'),
  validate({ params: memberParamSchema }),
  asyncHandler(memberController.getById.bind(memberController)),
);
memberRouter.patch(
  '/:id',
  requirePermission('members:update'),
  validate({ params: memberParamSchema, body: updateMemberSchema }),
  asyncHandler(memberController.update.bind(memberController)),
);
memberRouter.delete(
  '/:id',
  requirePermission('members:delete'),
  validate({ params: memberParamSchema }),
  asyncHandler(memberController.softDelete.bind(memberController)),
);

/** @openapi { "/members/{id}/activate": { post: { tags: [Members], summary: Activate a member, security: [{bearerAuth: []}], responses: { 200: { description: Activated } } } } } */
memberRouter.post(
  '/:id/activate',
  requirePermission('members:update'),
  validate({ params: memberParamSchema }),
  asyncHandler(memberController.activate.bind(memberController)),
);

/** @openapi { "/members/{id}/deactivate": { post: { tags: [Members], summary: Deactivate a member, security: [{bearerAuth: []}], responses: { 200: { description: Deactivated } } } } } */
memberRouter.post(
  '/:id/deactivate',
  requirePermission('members:update'),
  validate({ params: memberParamSchema }),
  asyncHandler(memberController.deactivate.bind(memberController)),
);

/** @openapi { "/members/{id}/freeze": { post: { tags: [Members], summary: Freeze a member (blocks future check-in), security: [{bearerAuth: []}], responses: { 200: { description: Frozen } } } } } */
memberRouter.post(
  '/:id/freeze',
  requirePermission('memberships:freeze'),
  validate({ params: memberParamSchema, body: freezeMembershipSchema }),
  asyncHandler(memberController.freeze.bind(memberController)),
);

/** @openapi { "/members/{id}/unfreeze": { post: { tags: [Members], summary: "Unfreeze a member (alias of /resume, kept for backward compatibility)", security: [{bearerAuth: []}], responses: { 200: { description: Unfrozen } } } } } */
memberRouter.post(
  '/:id/unfreeze',
  requirePermission('memberships:freeze'),
  validate({ params: memberParamSchema }),
  asyncHandler(memberController.unfreeze.bind(memberController)),
);

/** @openapi { "/members/{id}/resume": { post: { tags: [Members], summary: Resume a frozen membership, security: [{bearerAuth: []}], responses: { 200: { description: Resumed } } } } } */
memberRouter.post(
  '/:id/resume',
  requirePermission('memberships:freeze'),
  validate({ params: memberParamSchema }),
  asyncHandler(memberController.resumeMembership.bind(memberController)),
);

/** @openapi { "/members/{id}/restore": { post: { tags: [Members], summary: Restore a soft-deleted member, security: [{bearerAuth: []}], responses: { 200: { description: Restored } } } } } */
memberRouter.post(
  '/:id/restore',
  requirePermission('members:restore'),
  validate({ params: memberParamSchema }),
  asyncHandler(memberController.restore.bind(memberController)),
);

/** @openapi { "/members/{id}/membership": { put: { tags: [Members], summary: Assign a membership plan (member must have no active membership), security: [{bearerAuth: []}], responses: { 200: { description: Membership assigned }, 409: { description: Already has an active membership } } } } } */
memberRouter.put(
  '/:id/membership',
  requirePermission('memberships:assign'),
  validate({ params: memberParamSchema, body: assignMembershipSchema }),
  asyncHandler(memberController.assignMembership.bind(memberController)),
);

/** @openapi { "/members/{id}/membership/renew": { post: { tags: [Members], summary: Renew the current active membership, security: [{bearerAuth: []}], responses: { 200: { description: Membership renewed } } } } } */
memberRouter.post(
  '/:id/membership/renew',
  requirePermission('memberships:renew'),
  validate({ params: memberParamSchema, body: renewMembershipSchema }),
  asyncHandler(memberController.renewMembership.bind(memberController)),
);

/** @openapi { "/members/{id}/membership/extend": { post: { tags: [Members], summary: Extend the current active membership by N days without changing plan, security: [{bearerAuth: []}], responses: { 200: { description: Membership extended } } } } } */
memberRouter.post(
  '/:id/membership/extend',
  requirePermission('memberships:renew'),
  validate({ params: memberParamSchema, body: extendMembershipSchema }),
  asyncHandler(memberController.extendMembership.bind(memberController)),
);

/** @openapi { "/members/{id}/membership/upgrade": { post: { tags: [Members], summary: Upgrade to a different membership plan effective immediately, security: [{bearerAuth: []}], responses: { 200: { description: Membership upgraded } } } } } */
memberRouter.post(
  '/:id/membership/upgrade',
  requirePermission('memberships:upgrade'),
  validate({ params: memberParamSchema, body: upgradeMembershipSchema }),
  asyncHandler(memberController.upgradeMembership.bind(memberController)),
);

/** @openapi { "/members/{id}/membership/downgrade": { post: { tags: [Members], summary: Downgrade to a different membership plan effective immediately, security: [{bearerAuth: []}], responses: { 200: { description: Membership downgraded } } } } } */
memberRouter.post(
  '/:id/membership/downgrade',
  requirePermission('memberships:upgrade'),
  validate({ params: memberParamSchema, body: downgradeMembershipSchema }),
  asyncHandler(memberController.downgradeMembership.bind(memberController)),
);

/** @openapi { "/members/{id}/membership/cancel": { post: { tags: [Members], summary: Cancel the current active membership, security: [{bearerAuth: []}], responses: { 200: { description: Membership cancelled } } } } } */
memberRouter.post(
  '/:id/membership/cancel',
  requirePermission('memberships:upgrade'),
  validate({ params: memberParamSchema, body: cancelMembershipSchema }),
  asyncHandler(memberController.cancelMembership.bind(memberController)),
);

/** @openapi { "/members/{id}/branch": { put: { tags: [Members], summary: Transfer the member to a different branch, security: [{bearerAuth: []}], responses: { 200: { description: Transferred } } } } } */
memberRouter.put(
  '/:id/branch',
  requirePermission('members:update'),
  validate({ params: memberParamSchema, body: transferBranchSchema }),
  asyncHandler(memberController.transferBranch.bind(memberController)),
);

/** @openapi { "/members/{id}/trainer": { put: { tags: [Members], summary: Assign or unassign the member's trainer, security: [{bearerAuth: []}], responses: { 200: { description: Trainer assignment updated } } } } } */
memberRouter.put(
  '/:id/trainer',
  requirePermission('members:assign-trainer'),
  validate({ params: memberParamSchema, body: assignTrainerSchema }),
  asyncHandler(memberController.assignTrainer.bind(memberController)),
);

/** @openapi { "/members/{id}/qr-code": { post: { tags: [Members], summary: Regenerate the member's QR code, security: [{bearerAuth: []}], responses: { 200: { description: "{ qrCodeToken, qrCodeImageUrl }" } } } } } */
memberRouter.post(
  '/:id/qr-code',
  requirePermission('members:update'),
  validate({ params: memberParamSchema }),
  asyncHandler(memberController.regenerateQrCode.bind(memberController)),
);

/**
 * @openapi
 * /members/{id}/documents:
 *   get:
 *     tags: [Members]
 *     summary: List a member's uploaded documents
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Documents }
 *   post:
 *     tags: [Members]
 *     summary: Upload a document (identity/address proof, medical certificate, consent form, other)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: Document uploaded }
 */
memberRouter.get(
  '/:id/documents',
  requirePermission('members:view'),
  validate({ params: memberParamSchema }),
  asyncHandler(memberController.listDocuments.bind(memberController)),
);
memberRouter.post(
  '/:id/documents',
  requirePermission('members:update'),
  validate({ params: memberParamSchema, body: uploadMemberDocumentSchema }),
  asyncHandler(memberController.uploadDocument.bind(memberController)),
);

/** @openapi { "/members/{id}/documents/{documentId}": { delete: { tags: [Members], summary: Delete an uploaded document, security: [{bearerAuth: []}], responses: { 200: { description: Deleted } } } } } */
memberRouter.delete(
  '/:id/documents/:documentId',
  requirePermission('members:update'),
  validate({ params: memberDocumentParamSchema }),
  asyncHandler(memberController.deleteDocument.bind(memberController)),
);
