import { Router } from 'express';

import { validate } from '../../../core/middleware/validate.middleware';
import { requireAnyPermission, requirePermission } from '../../authentication/middlewares/authorize.middleware';
import { hrSelfController } from '../controllers/hr-self.controller';
import {
  applyLeaveBodySchema,
  cancelLeaveBodySchema,
  checkInBodySchema,
  enrollBodySchema,
  idParamSchema,
  leavePreviewBodySchema,
  leaveYearQuerySchema,
  listMyLeavesQuerySchema,
  listMyPayslipsQuerySchema,
  listNotificationsQuerySchema,
  monthQuerySchema,
  yearQuerySchema,
} from '../validators/hr.validators';

const asyncHandler =
  <T extends (req: never, res: never) => Promise<void>>(fn: T) =>
  (req: Parameters<T>[0], res: Parameters<T>[1], next: (err?: unknown) => void) => {
    Promise.resolve(fn(req, res)).catch(next);
  };

export const hrSelfRouter: Router = Router();
const c = hrSelfController;


/** @openapi { "/hr/me/summary": { get: { tags: [HR], summary: "My HR home: today attendance state, month stats, leave balances, pending leaves, holidays (hr:self_attendance)", security: [{bearerAuth: []}], responses: { 200: { description: OK }, 403: { description: Forbidden }, 409: { description: Conflict }, 422: { description: Validation failed } } } } } */
hrSelfRouter.get('/me/summary', requirePermission('hr:self_attendance'), asyncHandler(c.summary.bind(c)));

/** @openapi { "/hr/me/enroll": { post: { tags: [HR], summary: "Opt-in: create my own employee profile (e.g. the owner); 201 = /hr/me/summary, 409 ALREADY_EMPLOYEE (hr:self_attendance or hr:self_leave)", security: [{bearerAuth: []}], responses: { 201: { description: Created }, 403: { description: Forbidden }, 409: { description: Conflict }, 422: { description: Validation failed } } } } } */
hrSelfRouter.post('/me/enroll', requireAnyPermission('hr:self_attendance', 'hr:self_leave'), validate({ body: enrollBodySchema }), asyncHandler(c.enroll.bind(c)));

/** @openapi { "/hr/me/attendance/check-in": { post: { tags: [HR], summary: "Check in for today (409 ALREADY_CHECKED_IN) (hr:self_attendance)", security: [{bearerAuth: []}], responses: { 200: { description: OK }, 403: { description: Forbidden }, 409: { description: Conflict }, 422: { description: Validation failed } } } } } */
hrSelfRouter.post('/me/attendance/check-in', requirePermission('hr:self_attendance'), validate({ body: checkInBodySchema }), asyncHandler(c.checkIn.bind(c)));

/** @openapi { "/hr/me/attendance/check-out": { post: { tags: [HR], summary: "Check out for today (409 NOT_CHECKED_IN / ALREADY_CHECKED_OUT) (hr:self_attendance)", security: [{bearerAuth: []}], responses: { 200: { description: OK }, 403: { description: Forbidden }, 409: { description: Conflict }, 422: { description: Validation failed } } } } } */
hrSelfRouter.post('/me/attendance/check-out', requirePermission('hr:self_attendance'), validate({ body: checkInBodySchema }), asyncHandler(c.checkOut.bind(c)));

/** @openapi { "/hr/me/attendance": { get: { tags: [HR], summary: "My attendance for a month (hr:self_attendance)", security: [{bearerAuth: []}], responses: { 200: { description: OK }, 403: { description: Forbidden }, 409: { description: Conflict }, 422: { description: Validation failed } } } } } */
hrSelfRouter.get('/me/attendance', requirePermission('hr:self_attendance'), validate({ query: monthQuerySchema }), asyncHandler(c.attendance.bind(c)));

/** @openapi { "/hr/me/leave-types": { get: { tags: [HR], summary: "Active leave types for the apply form (hr:self_leave)", security: [{bearerAuth: []}], responses: { 200: { description: OK }, 403: { description: Forbidden }, 409: { description: Conflict }, 422: { description: Validation failed } } } } } */
hrSelfRouter.get('/me/leave-types', requirePermission('hr:self_leave'), asyncHandler(c.leaveTypes.bind(c)));

/** @openapi { "/hr/me/leave-balances": { get: { tags: [HR], summary: "My leave balances for a leave year (hr:self_leave)", security: [{bearerAuth: []}], responses: { 200: { description: OK }, 403: { description: Forbidden }, 409: { description: Conflict }, 422: { description: Validation failed } } } } } */
hrSelfRouter.get('/me/leave-balances', requirePermission('hr:self_leave'), validate({ query: leaveYearQuerySchema }), asyncHandler(c.leaveBalances.bind(c)));

/** @openapi { "/hr/me/holidays": { get: { tags: [HR], summary: "Holidays applicable to me for a year (hr:self_leave)", security: [{bearerAuth: []}], responses: { 200: { description: OK }, 403: { description: Forbidden }, 409: { description: Conflict }, 422: { description: Validation failed } } } } } */
hrSelfRouter.get('/me/holidays', requirePermission('hr:self_leave'), validate({ query: yearQuerySchema }), asyncHandler(c.holidays.bind(c)));

/** @openapi { "/hr/me/leaves/preview": { post: { tags: [HR], summary: "Preview computed leave days and balance without saving (hr:self_leave)", security: [{bearerAuth: []}], responses: { 200: { description: OK }, 403: { description: Forbidden }, 409: { description: Conflict }, 422: { description: Validation failed } } } } } */
hrSelfRouter.post('/me/leaves/preview', requirePermission('hr:self_leave'), validate({ body: leavePreviewBodySchema }), asyncHandler(c.previewLeave.bind(c)));

/** @openapi { "/hr/me/leaves": { get: { tags: [HR], summary: "My leave requests (paginated) (hr:self_leave)", security: [{bearerAuth: []}], responses: { 200: { description: OK }, 403: { description: Forbidden }, 409: { description: Conflict }, 422: { description: Validation failed } } } } } */
hrSelfRouter.get('/me/leaves', requirePermission('hr:self_leave'), validate({ query: listMyLeavesQuerySchema }), asyncHandler(c.listLeaves.bind(c)));

/** @openapi { "/hr/me/leaves": { post: { tags: [HR], summary: "Apply for leave (full day / half day morning / half day evening) (hr:self_leave)", security: [{bearerAuth: []}], responses: { 200: { description: OK }, 403: { description: Forbidden }, 409: { description: Conflict }, 422: { description: Validation failed } } } } } */
hrSelfRouter.post('/me/leaves', requirePermission('hr:self_leave'), validate({ body: applyLeaveBodySchema }), asyncHandler(c.applyLeave.bind(c)));

/** @openapi { "/hr/me/leaves/{id}": { get: { tags: [HR], summary: "One of my leave requests (hr:self_leave)", security: [{bearerAuth: []}], parameters: [{in: path, name: id, required: true, schema: {type: string}}], responses: { 200: { description: OK }, 403: { description: Forbidden }, 409: { description: Conflict }, 422: { description: Validation failed } } } } } */
hrSelfRouter.get('/me/leaves/:id', requirePermission('hr:self_leave'), validate({ params: idParamSchema }), asyncHandler(c.getLeave.bind(c)));

/** @openapi { "/hr/me/leaves/{id}/cancel": { post: { tags: [HR], summary: "Cancel my pending (or future approved) leave (hr:self_leave)", security: [{bearerAuth: []}], parameters: [{in: path, name: id, required: true, schema: {type: string}}], responses: { 200: { description: OK }, 403: { description: Forbidden }, 409: { description: Conflict }, 422: { description: Validation failed } } } } } */
hrSelfRouter.post('/me/leaves/:id/cancel', requirePermission('hr:self_leave'), validate({ params: idParamSchema, body: cancelLeaveBodySchema }), asyncHandler(c.cancelLeave.bind(c)));

/** @openapi { "/hr/me/payslips": { get: { tags: [HR], summary: "My approved/paid payslips (paginated) (hr:self_payslip)", security: [{bearerAuth: []}], responses: { 200: { description: OK }, 403: { description: Forbidden }, 409: { description: Conflict }, 422: { description: Validation failed } } } } } */
hrSelfRouter.get('/me/payslips', requirePermission('hr:self_payslip'), validate({ query: listMyPayslipsQuerySchema }), asyncHandler(c.listPayslips.bind(c)));

/** @openapi { "/hr/me/payslips/{id}": { get: { tags: [HR], summary: "One of my payslips (hr:self_payslip)", security: [{bearerAuth: []}], parameters: [{in: path, name: id, required: true, schema: {type: string}}], responses: { 200: { description: OK }, 403: { description: Forbidden }, 409: { description: Conflict }, 422: { description: Validation failed } } } } } */
hrSelfRouter.get('/me/payslips/:id', requirePermission('hr:self_payslip'), validate({ params: idParamSchema }), asyncHandler(c.getPayslip.bind(c)));

/** @openapi { "/hr/me/payslips/{id}/pdf": { get: { tags: [HR], summary: "My payslip as PDF (hr:self_payslip)", security: [{bearerAuth: []}], parameters: [{in: path, name: id, required: true, schema: {type: string}}], responses: { 200: { description: OK }, 403: { description: Forbidden }, 409: { description: Conflict }, 422: { description: Validation failed } } } } } */
hrSelfRouter.get('/me/payslips/:id/pdf', requirePermission('hr:self_payslip'), validate({ params: idParamSchema }), asyncHandler(c.payslipPdf.bind(c)));

/** @openapi { "/hr/me/notifications": { get: { tags: [HR], summary: "My HR notifications inbox (hr:self_leave)", security: [{bearerAuth: []}], responses: { 200: { description: OK }, 403: { description: Forbidden }, 409: { description: Conflict }, 422: { description: Validation failed } } } } } */
hrSelfRouter.get('/me/notifications', requirePermission('hr:self_leave'), validate({ query: listNotificationsQuerySchema }), asyncHandler(c.notifications.bind(c)));

/** @openapi { "/hr/me/notifications/read-all": { post: { tags: [HR], summary: "Mark all my HR notifications read (hr:self_leave)", security: [{bearerAuth: []}], responses: { 200: { description: OK }, 403: { description: Forbidden }, 409: { description: Conflict }, 422: { description: Validation failed } } } } } */
hrSelfRouter.post('/me/notifications/read-all', requirePermission('hr:self_leave'), asyncHandler(c.markAllNotificationsRead.bind(c)));

/** @openapi { "/hr/me/notifications/{id}/read": { post: { tags: [HR], summary: "Mark one HR notification read (hr:self_leave)", security: [{bearerAuth: []}], parameters: [{in: path, name: id, required: true, schema: {type: string}}], responses: { 200: { description: OK }, 403: { description: Forbidden }, 409: { description: Conflict }, 422: { description: Validation failed } } } } } */
hrSelfRouter.post('/me/notifications/:id/read', requirePermission('hr:self_leave'), validate({ params: idParamSchema }), asyncHandler(c.markNotificationRead.bind(c)));

