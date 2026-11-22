import { Router } from 'express';

import { validate } from '../../../core/middleware/validate.middleware';
import { requirePermission } from '../../authentication/middlewares/authorize.middleware';
import { hrPayrollController } from '../controllers/hr-payroll.controller';
import {
  createRunBodySchema,
  idParamSchema,
  listRunsQuerySchema,
  patchPayslipBodySchema,
  payBodySchema,
} from '../validators/hr.validators';

const asyncHandler =
  <T extends (req: never, res: never) => Promise<void>>(fn: T) =>
  (req: Parameters<T>[0], res: Parameters<T>[1], next: (err?: unknown) => void) => {
    Promise.resolve(fn(req, res)).catch(next);
  };

export const hrPayrollRouter: Router = Router();
const c = hrPayrollController;


/** @openapi { "/hr/payroll/runs": { get: { tags: [HR], summary: "Payroll runs (paginated) (hr:payroll_manage)", security: [{bearerAuth: []}], responses: { 200: { description: OK }, 403: { description: Forbidden }, 409: { description: Conflict }, 422: { description: Validation failed } } } } } */
hrPayrollRouter.get('/payroll/runs', requirePermission('hr:payroll_manage'), validate({ query: listRunsQuerySchema }), asyncHandler(c.listRuns.bind(c)));

/** @openapi { "/hr/payroll/runs": { post: { tags: [HR], summary: "Generate a DRAFT payroll run for a month (hr:payroll_manage)", security: [{bearerAuth: []}], responses: { 200: { description: OK }, 403: { description: Forbidden }, 409: { description: Conflict }, 422: { description: Validation failed } } } } } */
hrPayrollRouter.post('/payroll/runs', requirePermission('hr:payroll_manage'), validate({ body: createRunBodySchema }), asyncHandler(c.createRun.bind(c)));

/** @openapi { "/hr/payroll/runs/{id}": { get: { tags: [HR], summary: "Run with all payslips (hr:payroll_manage)", security: [{bearerAuth: []}], parameters: [{in: path, name: id, required: true, schema: {type: string}}], responses: { 200: { description: OK }, 403: { description: Forbidden }, 409: { description: Conflict }, 422: { description: Validation failed } } } } } */
hrPayrollRouter.get('/payroll/runs/:id', requirePermission('hr:payroll_manage'), validate({ params: idParamSchema }), asyncHandler(c.runDetail.bind(c)));

/** @openapi { "/hr/payroll/runs/{id}/recalculate": { post: { tags: [HR], summary: "Recalculate a DRAFT run (hr:payroll_manage)", security: [{bearerAuth: []}], parameters: [{in: path, name: id, required: true, schema: {type: string}}], responses: { 200: { description: OK }, 403: { description: Forbidden }, 409: { description: Conflict }, 422: { description: Validation failed } } } } } */
hrPayrollRouter.post('/payroll/runs/:id/recalculate', requirePermission('hr:payroll_manage'), validate({ params: idParamSchema }), asyncHandler(c.recalculate.bind(c)));

/** @openapi { "/hr/payroll/runs/{id}": { delete: { tags: [HR], summary: "Delete a DRAFT run (hr:payroll_manage)", security: [{bearerAuth: []}], parameters: [{in: path, name: id, required: true, schema: {type: string}}], responses: { 200: { description: OK }, 403: { description: Forbidden }, 409: { description: Conflict }, 422: { description: Validation failed } } } } } */
hrPayrollRouter.delete('/payroll/runs/:id', requirePermission('hr:payroll_manage'), validate({ params: idParamSchema }), asyncHandler(c.deleteRun.bind(c)));

/** @openapi { "/hr/payroll/runs/{id}/approve": { post: { tags: [HR], summary: "Approve a DRAFT run (locks it) (hr:payroll_manage)", security: [{bearerAuth: []}], parameters: [{in: path, name: id, required: true, schema: {type: string}}], responses: { 200: { description: OK }, 403: { description: Forbidden }, 409: { description: Conflict }, 422: { description: Validation failed } } } } } */
hrPayrollRouter.post('/payroll/runs/:id/approve', requirePermission('hr:payroll_manage'), validate({ params: idParamSchema }), asyncHandler(c.approve.bind(c)));

/** @openapi { "/hr/payroll/runs/{id}/pay-all": { post: { tags: [HR], summary: "Pay every unpaid payslip of an approved run (one Expense each) (hr:payroll_manage)", security: [{bearerAuth: []}], parameters: [{in: path, name: id, required: true, schema: {type: string}}], responses: { 200: { description: OK }, 403: { description: Forbidden }, 409: { description: Conflict }, 422: { description: Validation failed } } } } } */
hrPayrollRouter.post('/payroll/runs/:id/pay-all', requirePermission('hr:payroll_manage'), validate({ params: idParamSchema, body: payBodySchema }), asyncHandler(c.payAll.bind(c)));

/** @openapi { "/hr/payroll/payslips/{id}": { get: { tags: [HR], summary: "One payslip (hr:payroll_manage)", security: [{bearerAuth: []}], parameters: [{in: path, name: id, required: true, schema: {type: string}}], responses: { 200: { description: OK }, 403: { description: Forbidden }, 409: { description: Conflict }, 422: { description: Validation failed } } } } } */
hrPayrollRouter.get('/payroll/payslips/:id', requirePermission('hr:payroll_manage'), validate({ params: idParamSchema }), asyncHandler(c.getPayslip.bind(c)));

/** @openapi { "/hr/payroll/payslips/{id}": { patch: { tags: [HR], summary: "Edit bonus / advance / manual lines of a DRAFT payslip (hr:payroll_manage)", security: [{bearerAuth: []}], parameters: [{in: path, name: id, required: true, schema: {type: string}}], responses: { 200: { description: OK }, 403: { description: Forbidden }, 409: { description: Conflict }, 422: { description: Validation failed } } } } } */
hrPayrollRouter.patch('/payroll/payslips/:id', requirePermission('hr:payroll_manage'), validate({ params: idParamSchema, body: patchPayslipBodySchema }), asyncHandler(c.patchPayslip.bind(c)));

/** @openapi { "/hr/payroll/payslips/{id}/pay": { post: { tags: [HR], summary: "Mark a payslip paid and record ONE salary Expense (409 ALREADY_PAID on repeat) (hr:payroll_manage)", security: [{bearerAuth: []}], parameters: [{in: path, name: id, required: true, schema: {type: string}}], responses: { 200: { description: OK }, 403: { description: Forbidden }, 409: { description: Conflict }, 422: { description: Validation failed } } } } } */
hrPayrollRouter.post('/payroll/payslips/:id/pay', requirePermission('hr:payroll_manage'), validate({ params: idParamSchema, body: payBodySchema }), asyncHandler(c.pay.bind(c)));

/** @openapi { "/hr/payroll/payslips/{id}/pdf": { get: { tags: [HR], summary: "Payslip as PDF (hr:payroll_manage)", security: [{bearerAuth: []}], parameters: [{in: path, name: id, required: true, schema: {type: string}}], responses: { 200: { description: OK }, 403: { description: Forbidden }, 409: { description: Conflict }, 422: { description: Validation failed } } } } } */
hrPayrollRouter.get('/payroll/payslips/:id/pdf', requirePermission('hr:payroll_manage'), validate({ params: idParamSchema }), asyncHandler(c.payslipPdf.bind(c)));

