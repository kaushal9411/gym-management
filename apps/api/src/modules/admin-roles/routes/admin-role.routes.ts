import { Router } from 'express';

import { validate } from '../../../core/middleware/validate.middleware';
import { adminAuthenticateMiddleware } from '../../admin-auth/middlewares/admin-authenticate.middleware';
import { requireAdminPermission } from '../../admin-auth/middlewares/admin-authorize.middleware';
import { adminRoleController } from '../controllers/admin-role.controller';
import {
  adminIdParamSchema,
  createAdminSchema,
  createRoleSchema,
  listAdminsQuerySchema,
  roleIdParamSchema,
  setAdminStatusSchema,
  updateAdminRoleSchema,
  updateRolePermissionsSchema,
} from '../validators/admin-role.validators';

export const adminRoleRouter: Router = Router();

const asyncHandler =
  <T extends (req: never, res: never) => Promise<void>>(fn: T) =>
  (req: Parameters<T>[0], res: Parameters<T>[1], next: (err?: unknown) => void) => {
    Promise.resolve(fn(req, res)).catch(next);
  };

adminRoleRouter.use(adminAuthenticateMiddleware, requireAdminPermission('admins:manage'));

/** @openapi { "/admin/roles/permissions": { get: { tags: [Admin Roles], summary: List the admin permission catalog, security: [{bearerAuth: []}], responses: { 200: { description: Permissions } } } } } */
adminRoleRouter.get('/permissions', asyncHandler(adminRoleController.listPermissions.bind(adminRoleController)));

/** @openapi { "/admin/roles": { get: { tags: [Admin Roles], summary: List admin roles (system + custom), security: [{bearerAuth: []}], responses: { 200: { description: Roles } } } } } */
adminRoleRouter.get('/', asyncHandler(adminRoleController.listRoles.bind(adminRoleController)));

/** @openapi { "/admin/roles": { post: { tags: [Admin Roles], summary: Create Custom Role, security: [{bearerAuth: []}], responses: { 201: { description: Created } } } } } */
adminRoleRouter.post('/', validate({ body: createRoleSchema }), asyncHandler(adminRoleController.createRole.bind(adminRoleController)));

/** @openapi { "/admin/roles/{roleId}/permissions": { put: { tags: [Admin Roles], summary: Set Custom Permissions for a role, security: [{bearerAuth: []}], responses: { 200: { description: Updated }, 409: { description: Cannot edit a system role } } } } } */
adminRoleRouter.put(
  '/:roleId/permissions',
  validate({ params: roleIdParamSchema, body: updateRolePermissionsSchema }),
  asyncHandler(adminRoleController.updateRolePermissions.bind(adminRoleController)),
);

/** @openapi { "/admin/roles/admins": { get: { tags: [Admin Roles], summary: List admin staff accounts, security: [{bearerAuth: []}], responses: { 200: { description: Paginated admins } } } } } */
adminRoleRouter.get('/admins', validate({ query: listAdminsQuerySchema }), asyncHandler(adminRoleController.listAdmins.bind(adminRoleController)));

/** @openapi { "/admin/roles/admins": { post: { tags: [Admin Roles], summary: Create an admin staff account, security: [{bearerAuth: []}], responses: { 201: { description: "{ id, name, email, temporaryPassword }" } } } } } */
adminRoleRouter.post('/admins', validate({ body: createAdminSchema }), asyncHandler(adminRoleController.createAdmin.bind(adminRoleController)));

/** @openapi { "/admin/roles/admins/{adminId}/role": { patch: { tags: [Admin Roles], summary: Change an admin's role, security: [{bearerAuth: []}], responses: { 200: { description: Updated } } } } } */
adminRoleRouter.patch(
  '/admins/:adminId/role',
  validate({ params: adminIdParamSchema, body: updateAdminRoleSchema }),
  asyncHandler(adminRoleController.updateAdminRole.bind(adminRoleController)),
);

/** @openapi { "/admin/roles/admins/{adminId}/status": { patch: { tags: [Admin Roles], summary: Suspend/reactivate an admin account, security: [{bearerAuth: []}], responses: { 200: { description: Updated } } } } } */
adminRoleRouter.patch(
  '/admins/:adminId/status',
  validate({ params: adminIdParamSchema, body: setAdminStatusSchema }),
  asyncHandler(adminRoleController.setAdminStatus.bind(adminRoleController)),
);
