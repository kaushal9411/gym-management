import { Router } from 'express';

import { validate } from '../../../core/middleware/validate.middleware';
import { requirePermission } from '../../authentication/middlewares/authorize.middleware';
import { hrAdminController } from '../controllers/hr-admin.controller';
import {
  adjustBalanceBodySchema,
  approveLeaveBodySchema,
  attendanceDayQuerySchema,
  attendanceMonthlyQuerySchema,
  bulkAttendanceBodySchema,
  clearAttendanceQuerySchema,
  createHolidayBodySchema,
  createLeaveTypeBodySchema,
  createShiftBodySchema,
  employeeDetailQuerySchema,
  hrApplyLeaveBodySchema,
  hrCancelLeaveBodySchema,
  hrLeavePreviewBodySchema,
  idParamSchema,
  leaveBalancesQuerySchema,
  listEmployeesQuerySchema,
  listHolidaysQuerySchema,
  listLeaveTypesQuerySchema,
  listLeavesQuerySchema,
  markAttendanceBodySchema,
  monthQuerySchema,
  payStructureBodySchema,
  rejectLeaveBodySchema,
  updateHolidayBodySchema,
  updateLeaveTypeBodySchema,
  updatePolicyBodySchema,
  updateShiftBodySchema,
  userIdParamSchema,
  workSetupBodySchema,
} from '../validators/hr.validators';

const asyncHandler =
  <T extends (req: never, res: never) => Promise<void>>(fn: T) =>
  (req: Parameters<T>[0], res: Parameters<T>[1], next: (err?: unknown) => void) => {
    Promise.resolve(fn(req, res)).catch(next);
  };

export const hrAdminRouter: Router = Router();
const c = hrAdminController;


/** @openapi { "/hr/overview": { get: { tags: [HR], summary: "HR dashboard: today buckets, pending approvals, payroll status, upcoming leaves, 7-day trend (hr:view)", security: [{bearerAuth: []}], responses: { 200: { description: OK }, 403: { description: Forbidden }, 409: { description: Conflict }, 422: { description: Validation failed } } } } } */
hrAdminRouter.get('/overview', requirePermission('hr:view'), asyncHandler(c.overview.bind(c)));

/** @openapi { "/hr/employees": { get: { tags: [HR], summary: "Employees with today status and leave balances (paginated) (hr:view)", security: [{bearerAuth: []}], responses: { 200: { description: OK }, 403: { description: Forbidden }, 409: { description: Conflict }, 422: { description: Validation failed } } } } } */
hrAdminRouter.get('/employees', requirePermission('hr:view'), validate({ query: listEmployeesQuerySchema }), asyncHandler(c.listEmployees.bind(c)));

/** @openapi { "/hr/employees/{userId}": { get: { tags: [HR], summary: "Employee HR profile: attendance month, leaves, balances, pay structure and payslips (last two need hr:payroll_manage) (hr:view)", security: [{bearerAuth: []}], parameters: [{in: path, name: userId, required: true, schema: {type: string}}], responses: { 200: { description: OK }, 403: { description: Forbidden }, 409: { description: Conflict }, 422: { description: Validation failed } } } } } */
hrAdminRouter.get('/employees/:userId', requirePermission('hr:view'), validate({ params: userIdParamSchema, query: employeeDetailQuerySchema }), asyncHandler(c.employeeDetail.bind(c)));

/** @openapi { "/hr/employees/{userId}/attendance": { get: { tags: [HR], summary: "One employee attendance for a month (hr:view)", security: [{bearerAuth: []}], parameters: [{in: path, name: userId, required: true, schema: {type: string}}], responses: { 200: { description: OK }, 403: { description: Forbidden }, 409: { description: Conflict }, 422: { description: Validation failed } } } } } */
hrAdminRouter.get('/employees/:userId/attendance', requirePermission('hr:view'), validate({ params: userIdParamSchema, query: monthQuerySchema }), asyncHandler(c.employeeAttendance.bind(c)));

/** @openapi { "/hr/employees/{userId}/work-setup": { put: { tags: [HR], summary: "Assign shift and/or weekly off (hr:settings_manage)", security: [{bearerAuth: []}], parameters: [{in: path, name: userId, required: true, schema: {type: string}}], responses: { 200: { description: OK }, 403: { description: Forbidden }, 409: { description: Conflict }, 422: { description: Validation failed } } } } } */
hrAdminRouter.put('/employees/:userId/work-setup', requirePermission('hr:settings_manage'), validate({ params: userIdParamSchema, body: workSetupBodySchema }), asyncHandler(c.setWorkSetup.bind(c)));

/** @openapi { "/hr/employees/{userId}/pay-structure": { get: { tags: [HR], summary: "Base salary + allowance/deduction components (hr:payroll_manage)", security: [{bearerAuth: []}], parameters: [{in: path, name: userId, required: true, schema: {type: string}}], responses: { 200: { description: OK }, 403: { description: Forbidden }, 409: { description: Conflict }, 422: { description: Validation failed } } } } } */
hrAdminRouter.get('/employees/:userId/pay-structure', requirePermission('hr:payroll_manage'), validate({ params: userIdParamSchema }), asyncHandler(c.getPayStructure.bind(c)));

/** @openapi { "/hr/employees/{userId}/pay-structure": { put: { tags: [HR], summary: "Replace base salary and components (hr:payroll_manage)", security: [{bearerAuth: []}], parameters: [{in: path, name: userId, required: true, schema: {type: string}}], responses: { 200: { description: OK }, 403: { description: Forbidden }, 409: { description: Conflict }, 422: { description: Validation failed } } } } } */
hrAdminRouter.put('/employees/:userId/pay-structure', requirePermission('hr:payroll_manage'), validate({ params: userIdParamSchema, body: payStructureBodySchema }), asyncHandler(c.setPayStructure.bind(c)));

/** @openapi { "/hr/attendance": { get: { tags: [HR], summary: "Everyone attendance for one date (hr:view)", security: [{bearerAuth: []}], responses: { 200: { description: OK }, 403: { description: Forbidden }, 409: { description: Conflict }, 422: { description: Validation failed } } } } } */
hrAdminRouter.get('/attendance', requirePermission('hr:view'), validate({ query: attendanceDayQuerySchema }), asyncHandler(c.attendanceDay.bind(c)));

/** @openapi { "/hr/attendance/monthly": { get: { tags: [HR], summary: "Month grid of statuses for everyone (hr:view)", security: [{bearerAuth: []}], responses: { 200: { description: OK }, 403: { description: Forbidden }, 409: { description: Conflict }, 422: { description: Validation failed } } } } } */
hrAdminRouter.get('/attendance/monthly', requirePermission('hr:view'), validate({ query: attendanceMonthlyQuerySchema }), asyncHandler(c.attendanceMonthly.bind(c)));

/** @openapi { "/hr/attendance": { put: { tags: [HR], summary: "Manually mark or override one employee day (remark required) (hr:attendance_manage)", security: [{bearerAuth: []}], responses: { 200: { description: OK }, 403: { description: Forbidden }, 409: { description: Conflict }, 422: { description: Validation failed } } } } } */
hrAdminRouter.put('/attendance', requirePermission('hr:attendance_manage'), validate({ body: markAttendanceBodySchema }), asyncHandler(c.markAttendance.bind(c)));

/** @openapi { "/hr/attendance/bulk": { post: { tags: [HR], summary: "Bulk mark one date for many employees (hr:attendance_manage)", security: [{bearerAuth: []}], responses: { 200: { description: OK }, 403: { description: Forbidden }, 409: { description: Conflict }, 422: { description: Validation failed } } } } } */
hrAdminRouter.post('/attendance/bulk', requirePermission('hr:attendance_manage'), validate({ body: bulkAttendanceBodySchema }), asyncHandler(c.bulkAttendance.bind(c)));

/** @openapi { "/hr/attendance": { delete: { tags: [HR], summary: "Clear a recorded attendance row (remark required) (hr:attendance_manage)", security: [{bearerAuth: []}], responses: { 200: { description: OK }, 403: { description: Forbidden }, 409: { description: Conflict }, 422: { description: Validation failed } } } } } */
hrAdminRouter.delete('/attendance', requirePermission('hr:attendance_manage'), validate({ query: clearAttendanceQuerySchema }), asyncHandler(c.clearAttendance.bind(c)));

/** @openapi { "/hr/leaves": { get: { tags: [HR], summary: "All leave requests with filters and status counts (hr:leave_manage)", security: [{bearerAuth: []}], responses: { 200: { description: OK }, 403: { description: Forbidden }, 409: { description: Conflict }, 422: { description: Validation failed } } } } } */
hrAdminRouter.get('/leaves', requirePermission('hr:leave_manage'), validate({ query: listLeavesQuerySchema }), asyncHandler(c.listLeaves.bind(c)));

/** @openapi { "/hr/leaves/preview": { post: { tags: [HR], summary: "Preview leave days for an employee (hr:leave_manage)", security: [{bearerAuth: []}], responses: { 200: { description: OK }, 403: { description: Forbidden }, 409: { description: Conflict }, 422: { description: Validation failed } } } } } */
hrAdminRouter.post('/leaves/preview', requirePermission('hr:leave_manage'), validate({ body: hrLeavePreviewBodySchema }), asyncHandler(c.previewLeave.bind(c)));

/** @openapi { "/hr/leaves": { post: { tags: [HR], summary: "Apply leave on behalf of an employee (optionally auto-approve) (hr:leave_manage)", security: [{bearerAuth: []}], responses: { 200: { description: OK }, 403: { description: Forbidden }, 409: { description: Conflict }, 422: { description: Validation failed } } } } } */
hrAdminRouter.post('/leaves', requirePermission('hr:leave_manage'), validate({ body: hrApplyLeaveBodySchema }), asyncHandler(c.applyLeave.bind(c)));

/** @openapi { "/hr/leaves/{id}": { get: { tags: [HR], summary: "Leave request with balance and overlapping leaves (hr:leave_manage)", security: [{bearerAuth: []}], parameters: [{in: path, name: id, required: true, schema: {type: string}}], responses: { 200: { description: OK }, 403: { description: Forbidden }, 409: { description: Conflict }, 422: { description: Validation failed } } } } } */
hrAdminRouter.get('/leaves/:id', requirePermission('hr:leave_manage'), validate({ params: idParamSchema }), asyncHandler(c.leaveDetail.bind(c)));

/** @openapi { "/hr/leaves/{id}/approve": { post: { tags: [HR], summary: "Approve a pending leave (remark optional) (hr:leave_manage)", security: [{bearerAuth: []}], parameters: [{in: path, name: id, required: true, schema: {type: string}}], responses: { 200: { description: OK }, 403: { description: Forbidden }, 409: { description: Conflict }, 422: { description: Validation failed } } } } } */
hrAdminRouter.post('/leaves/:id/approve', requirePermission('hr:leave_manage'), validate({ params: idParamSchema, body: approveLeaveBodySchema }), asyncHandler(c.approveLeave.bind(c)));

/** @openapi { "/hr/leaves/{id}/reject": { post: { tags: [HR], summary: "Reject a pending leave (remark REQUIRED) (hr:leave_manage)", security: [{bearerAuth: []}], parameters: [{in: path, name: id, required: true, schema: {type: string}}], responses: { 200: { description: OK }, 403: { description: Forbidden }, 409: { description: Conflict }, 422: { description: Validation failed } } } } } */
hrAdminRouter.post('/leaves/:id/reject', requirePermission('hr:leave_manage'), validate({ params: idParamSchema, body: rejectLeaveBodySchema }), asyncHandler(c.rejectLeave.bind(c)));

/** @openapi { "/hr/leaves/{id}/cancel": { post: { tags: [HR], summary: "Cancel a pending/approved leave (remark REQUIRED) (hr:leave_manage)", security: [{bearerAuth: []}], parameters: [{in: path, name: id, required: true, schema: {type: string}}], responses: { 200: { description: OK }, 403: { description: Forbidden }, 409: { description: Conflict }, 422: { description: Validation failed } } } } } */
hrAdminRouter.post('/leaves/:id/cancel', requirePermission('hr:leave_manage'), validate({ params: idParamSchema, body: hrCancelLeaveBodySchema }), asyncHandler(c.cancelLeave.bind(c)));

/** @openapi { "/hr/leave-balances": { get: { tags: [HR], summary: "Leave balances for one employee or everyone (hr:leave_manage)", security: [{bearerAuth: []}], responses: { 200: { description: OK }, 403: { description: Forbidden }, 409: { description: Conflict }, 422: { description: Validation failed } } } } } */
hrAdminRouter.get('/leave-balances', requirePermission('hr:leave_manage'), validate({ query: leaveBalancesQuerySchema }), asyncHandler(c.leaveBalances.bind(c)));

/** @openapi { "/hr/leave-balances/adjust": { post: { tags: [HR], summary: "Manually credit/debit leave days (remark required) (hr:leave_manage)", security: [{bearerAuth: []}], responses: { 200: { description: OK }, 403: { description: Forbidden }, 409: { description: Conflict }, 422: { description: Validation failed } } } } } */
hrAdminRouter.post('/leave-balances/adjust', requirePermission('hr:leave_manage'), validate({ body: adjustBalanceBodySchema }), asyncHandler(c.adjustBalance.bind(c)));

/** @openapi { "/hr/leave-types": { get: { tags: [HR], summary: "Leave types (hr:view)", security: [{bearerAuth: []}], responses: { 200: { description: OK }, 403: { description: Forbidden }, 409: { description: Conflict }, 422: { description: Validation failed } } } } } */
hrAdminRouter.get('/leave-types', requirePermission('hr:view'), validate({ query: listLeaveTypesQuerySchema }), asyncHandler(c.listLeaveTypes.bind(c)));

/** @openapi { "/hr/leave-types": { post: { tags: [HR], summary: "Create a leave type (hr:leave_manage)", security: [{bearerAuth: []}], responses: { 200: { description: OK }, 403: { description: Forbidden }, 409: { description: Conflict }, 422: { description: Validation failed } } } } } */
hrAdminRouter.post('/leave-types', requirePermission('hr:leave_manage'), validate({ body: createLeaveTypeBodySchema }), asyncHandler(c.createLeaveType.bind(c)));

/** @openapi { "/hr/leave-types/{id}": { patch: { tags: [HR], summary: "Update a leave type (hr:leave_manage)", security: [{bearerAuth: []}], parameters: [{in: path, name: id, required: true, schema: {type: string}}], responses: { 200: { description: OK }, 403: { description: Forbidden }, 409: { description: Conflict }, 422: { description: Validation failed } } } } } */
hrAdminRouter.patch('/leave-types/:id', requirePermission('hr:leave_manage'), validate({ params: idParamSchema, body: updateLeaveTypeBodySchema }), asyncHandler(c.updateLeaveType.bind(c)));

/** @openapi { "/hr/leave-types/{id}": { delete: { tags: [HR], summary: "Delete an unused leave type (hr:leave_manage)", security: [{bearerAuth: []}], parameters: [{in: path, name: id, required: true, schema: {type: string}}], responses: { 200: { description: OK }, 403: { description: Forbidden }, 409: { description: Conflict }, 422: { description: Validation failed } } } } } */
hrAdminRouter.delete('/leave-types/:id', requirePermission('hr:leave_manage'), validate({ params: idParamSchema }), asyncHandler(c.deleteLeaveType.bind(c)));

/** @openapi { "/hr/holidays": { get: { tags: [HR], summary: "Holidays (hr:view)", security: [{bearerAuth: []}], responses: { 200: { description: OK }, 403: { description: Forbidden }, 409: { description: Conflict }, 422: { description: Validation failed } } } } } */
hrAdminRouter.get('/holidays', requirePermission('hr:view'), validate({ query: listHolidaysQuerySchema }), asyncHandler(c.listHolidays.bind(c)));

/** @openapi { "/hr/holidays": { post: { tags: [HR], summary: "Create a holiday (hr:leave_manage)", security: [{bearerAuth: []}], responses: { 200: { description: OK }, 403: { description: Forbidden }, 409: { description: Conflict }, 422: { description: Validation failed } } } } } */
hrAdminRouter.post('/holidays', requirePermission('hr:leave_manage'), validate({ body: createHolidayBodySchema }), asyncHandler(c.createHoliday.bind(c)));

/** @openapi { "/hr/holidays/{id}": { patch: { tags: [HR], summary: "Update a holiday (hr:leave_manage)", security: [{bearerAuth: []}], parameters: [{in: path, name: id, required: true, schema: {type: string}}], responses: { 200: { description: OK }, 403: { description: Forbidden }, 409: { description: Conflict }, 422: { description: Validation failed } } } } } */
hrAdminRouter.patch('/holidays/:id', requirePermission('hr:leave_manage'), validate({ params: idParamSchema, body: updateHolidayBodySchema }), asyncHandler(c.updateHoliday.bind(c)));

/** @openapi { "/hr/holidays/{id}": { delete: { tags: [HR], summary: "Delete a holiday (hr:leave_manage)", security: [{bearerAuth: []}], parameters: [{in: path, name: id, required: true, schema: {type: string}}], responses: { 200: { description: OK }, 403: { description: Forbidden }, 409: { description: Conflict }, 422: { description: Validation failed } } } } } */
hrAdminRouter.delete('/holidays/:id', requirePermission('hr:leave_manage'), validate({ params: idParamSchema }), asyncHandler(c.deleteHoliday.bind(c)));

/** @openapi { "/hr/shifts": { get: { tags: [HR], summary: "Shifts with employee counts (hr:view)", security: [{bearerAuth: []}], responses: { 200: { description: OK }, 403: { description: Forbidden }, 409: { description: Conflict }, 422: { description: Validation failed } } } } } */
hrAdminRouter.get('/shifts', requirePermission('hr:view'), asyncHandler(c.listShifts.bind(c)));

/** @openapi { "/hr/shifts": { post: { tags: [HR], summary: "Create a shift (hr:settings_manage)", security: [{bearerAuth: []}], responses: { 200: { description: OK }, 403: { description: Forbidden }, 409: { description: Conflict }, 422: { description: Validation failed } } } } } */
hrAdminRouter.post('/shifts', requirePermission('hr:settings_manage'), validate({ body: createShiftBodySchema }), asyncHandler(c.createShift.bind(c)));

/** @openapi { "/hr/shifts/{id}": { patch: { tags: [HR], summary: "Update a shift (hr:settings_manage)", security: [{bearerAuth: []}], parameters: [{in: path, name: id, required: true, schema: {type: string}}], responses: { 200: { description: OK }, 403: { description: Forbidden }, 409: { description: Conflict }, 422: { description: Validation failed } } } } } */
hrAdminRouter.patch('/shifts/:id', requirePermission('hr:settings_manage'), validate({ params: idParamSchema, body: updateShiftBodySchema }), asyncHandler(c.updateShift.bind(c)));

/** @openapi { "/hr/shifts/{id}": { delete: { tags: [HR], summary: "Delete an unused non-default shift (hr:settings_manage)", security: [{bearerAuth: []}], parameters: [{in: path, name: id, required: true, schema: {type: string}}], responses: { 200: { description: OK }, 403: { description: Forbidden }, 409: { description: Conflict }, 422: { description: Validation failed } } } } } */
hrAdminRouter.delete('/shifts/:id', requirePermission('hr:settings_manage'), validate({ params: idParamSchema }), asyncHandler(c.deleteShift.bind(c)));

/** @openapi { "/hr/policy": { get: { tags: [HR], summary: "HR policy (hr:view)", security: [{bearerAuth: []}], responses: { 200: { description: OK }, 403: { description: Forbidden }, 409: { description: Conflict }, 422: { description: Validation failed } } } } } */
hrAdminRouter.get('/policy', requirePermission('hr:view'), asyncHandler(c.getPolicy.bind(c)));

/** @openapi { "/hr/policy": { put: { tags: [HR], summary: "Update HR policy (partial) (hr:settings_manage)", security: [{bearerAuth: []}], responses: { 200: { description: OK }, 403: { description: Forbidden }, 409: { description: Conflict }, 422: { description: Validation failed } } } } } */
hrAdminRouter.put('/policy', requirePermission('hr:settings_manage'), validate({ body: updatePolicyBodySchema }), asyncHandler(c.updatePolicy.bind(c)));

