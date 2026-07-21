import { Router } from 'express';

import { validate } from '../../../core/middleware/validate.middleware';
import { authenticateMiddleware } from '../../authentication/middlewares/authenticate.middleware';
import { requirePermission } from '../../authentication/middlewares/authorize.middleware';
import { requireBranchAccess } from '../../authentication/middlewares/branch-access.middleware';
import { attendanceController } from '../controllers/attendance.controller';
import {
  attendanceParamSchema,
  branchAttendanceParamSchema,
  checkInSchema,
  checkOutSchema,
  listAttendanceQuerySchema,
  memberAttendanceParamSchema,
  paginationQuerySchema,
  summaryQuerySchema,
  updateAttendanceSchema,
  validateQrCodeSchema,
} from '../validators/attendance.validators';

export const attendanceRouter: Router = Router();

const asyncHandler =
  <T extends (req: never, res: never) => Promise<void>>(fn: T) =>
  (req: Parameters<T>[0], res: Parameters<T>[1], next: (err?: unknown) => void) => {
    Promise.resolve(fn(req, res)).catch(next);
  };

attendanceRouter.use(authenticateMiddleware);

/**
 * @openapi
 * /attendance/check-in:
 *   post:
 *     tags: [Attendance]
 *     summary: Check a member in (QR or another self-service method) — one open check-in per member, active/non-frozen/non-expired membership required
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: Checked in }
 *       409: { description: Already checked in, or not eligible }
 */
attendanceRouter.post(
  '/check-in',
  requirePermission('attendance:checkin'),
  requireBranchAccess('branchId'),
  validate({ body: checkInSchema }),
  asyncHandler(attendanceController.checkIn.bind(attendanceController)),
);

/**
 * @openapi
 * /attendance/check-out:
 *   post:
 *     tags: [Attendance]
 *     summary: Check a member out — requires an active (open) check-in
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Checked out }
 *       409: { description: No active check-in found }
 */
attendanceRouter.post(
  '/check-out',
  requirePermission('attendance:checkout'),
  validate({ body: checkOutSchema }),
  asyncHandler(attendanceController.checkOut.bind(attendanceController)),
);

/** @openapi { "/attendance/manual-check-in": { post: { tags: [Attendance], summary: "Front-desk manual check-in (no QR scan) — attributed to the staff member performing it", security: [{bearerAuth: []}], responses: { 201: { description: Checked in } } } } } */
attendanceRouter.post(
  '/manual-check-in',
  requirePermission('attendance:checkin'),
  requireBranchAccess('branchId'),
  validate({ body: checkInSchema }),
  asyncHandler(attendanceController.manualCheckIn.bind(attendanceController)),
);

/** @openapi { "/attendance/manual-check-out": { post: { tags: [Attendance], summary: "Front-desk manual check-out (no QR scan) — attributed to the staff member performing it", security: [{bearerAuth: []}], responses: { 200: { description: Checked out } } } } } */
attendanceRouter.post(
  '/manual-check-out',
  requirePermission('attendance:checkout'),
  validate({ body: checkOutSchema }),
  asyncHandler(attendanceController.manualCheckOut.bind(attendanceController)),
);

/** @openapi { "/attendance/validate-qr": { post: { tags: [Attendance], summary: "Look up a member by their QR token and report check-in eligibility, without recording a visit", security: [{bearerAuth: []}], responses: { 200: { description: Validation result } } } } } */
attendanceRouter.post(
  '/validate-qr',
  requirePermission('attendance:checkin'),
  validate({ body: validateQrCodeSchema }),
  asyncHandler(attendanceController.validateQrCode.bind(attendanceController)),
);

/** @openapi { "/attendance/today": { get: { tags: [Attendance], summary: "Today's attendance (optionally filtered to one branch)", security: [{bearerAuth: []}], responses: { 200: { description: "Attendance[]" } } } } } */
attendanceRouter.get('/today', requirePermission('attendance:view'), asyncHandler(attendanceController.getToday.bind(attendanceController)));

/** @openapi { "/attendance/summary": { get: { tags: [Attendance], summary: "Dashboard summary — today's check-ins/check-outs, currently inside, peak hour, trend", security: [{bearerAuth: []}], responses: { 200: { description: Summary } } } } } */
attendanceRouter.get(
  '/summary',
  requirePermission('attendance:view'),
  validate({ query: summaryQuerySchema }),
  asyncHandler(attendanceController.getSummary.bind(attendanceController)),
);

/** @openapi { "/attendance/export": { get: { tags: [Attendance], summary: "Download filtered attendance history as CSV", security: [{bearerAuth: []}], responses: { 200: { description: CSV file } } } } } */
attendanceRouter.get('/export', requirePermission('attendance:export'), asyncHandler(attendanceController.exportCsv.bind(attendanceController)));

/** @openapi { "/attendance/export/excel": { get: { tags: [Attendance], summary: "Download filtered attendance history as an Excel workbook", security: [{bearerAuth: []}], responses: { 200: { description: XLSX file } } } } } */
attendanceRouter.get('/export/excel', requirePermission('attendance:export'), asyncHandler(attendanceController.exportExcel.bind(attendanceController)));

/** @openapi { "/attendance/member/{memberId}": { get: { tags: [Attendance], summary: "One member's paginated attendance history", security: [{bearerAuth: []}], responses: { 200: { description: "{ items, total, page, limit, totalPages }" } } } } } */
attendanceRouter.get(
  '/member/:memberId',
  requirePermission('attendance:view'),
  validate({ params: memberAttendanceParamSchema, query: paginationQuerySchema }),
  asyncHandler(attendanceController.getMemberAttendance.bind(attendanceController)),
);

/** @openapi { "/attendance/branch/{branchId}": { get: { tags: [Attendance], summary: "One branch's paginated attendance history", security: [{bearerAuth: []}], responses: { 200: { description: "{ items, total, page, limit, totalPages }" } } } } } */
attendanceRouter.get(
  '/branch/:branchId',
  requirePermission('attendance:view'),
  requireBranchAccess('branchId'),
  validate({ params: branchAttendanceParamSchema, query: listAttendanceQuerySchema }),
  asyncHandler(attendanceController.getBranchAttendance.bind(attendanceController)),
);

/**
 * @openapi
 * /attendance:
 *   get:
 *     tags: [Attendance]
 *     summary: Paginated attendance history with search + filters (branch, member, status, method, date range)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: "{ items, total, page, limit, totalPages }" }
 */
attendanceRouter.get('/', requirePermission('attendance:view'), validate({ query: listAttendanceQuerySchema }), asyncHandler(attendanceController.list.bind(attendanceController)));

/** @openapi { "/attendance/{id}": { get: { tags: [Attendance], summary: "One attendance record's details", security: [{bearerAuth: []}], responses: { 200: { description: Attendance record } } } } } */
attendanceRouter.get(
  '/:id',
  requirePermission('attendance:view'),
  validate({ params: attendanceParamSchema }),
  asyncHandler(attendanceController.getById.bind(attendanceController)),
);

/** @openapi { "/attendance/{id}": { patch: { tags: [Attendance], summary: "Correct an attendance record's times/notes/status", security: [{bearerAuth: []}], responses: { 200: { description: Attendance record updated } } } } } */
attendanceRouter.patch(
  '/:id',
  requirePermission('attendance:update'),
  validate({ params: attendanceParamSchema, body: updateAttendanceSchema }),
  asyncHandler(attendanceController.update.bind(attendanceController)),
);

/** @openapi { "/attendance/{id}": { delete: { tags: [Attendance], summary: "Soft-delete an attendance record", security: [{bearerAuth: []}], responses: { 200: { description: Attendance record deleted } } } } } */
attendanceRouter.delete(
  '/:id',
  requirePermission('attendance:delete'),
  validate({ params: attendanceParamSchema }),
  asyncHandler(attendanceController.softDelete.bind(attendanceController)),
);
