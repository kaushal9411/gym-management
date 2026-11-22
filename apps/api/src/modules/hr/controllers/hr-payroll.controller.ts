import type { Request, Response } from 'express';

import { sendSuccess } from '../../../core/http/response';
import { actorFrom } from '../../authentication/utils/actor.util';
import { HrPayrollService } from '../services/hr-payroll.service';
import { renderPayslipPdf } from '../utils/payslip-pdf.renderer';

const svc = (req: Request): HrPayrollService => new HrPayrollService(req.tenant!.id);

export class HrPayrollController {
  async listRuns(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await svc(req).listRuns(req.query as never));
  }
  async createRun(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await svc(req).generate(req.body as never, actorFrom(req)), 'Payroll generated.', 201);
  }
  async runDetail(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await svc(req).runDetail(req.params.id!));
  }
  async recalculate(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await svc(req).recalculate(req.params.id!, actorFrom(req)), 'Payroll recalculated.');
  }
  async deleteRun(req: Request, res: Response): Promise<void> {
    await svc(req).deleteRun(req.params.id!, actorFrom(req));
    sendSuccess(res, null, 'Payroll run deleted.');
  }
  async approve(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await svc(req).approve(req.params.id!, actorFrom(req)), 'Payroll approved.');
  }
  async payAll(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await svc(req).payAll(req.params.id!, req.body as never, actorFrom(req)), 'Salaries paid.');
  }
  async getPayslip(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await svc(req).getPayslip(req.params.id!));
  }
  async patchPayslip(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await svc(req).patchPayslip(req.params.id!, req.body as never, actorFrom(req)), 'Payslip updated.');
  }
  async pay(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await svc(req).pay(req.params.id!, req.body as never, actorFrom(req)), 'Salary marked as paid.');
  }
  async payslipPdf(req: Request, res: Response): Promise<void> {
    const payslip = await svc(req).getPayslip(req.params.id!);
    const buffer = await renderPayslipPdf(payslip, req.tenant!.name);
    res.status(200).setHeader('Content-Type', 'application/pdf').setHeader('Content-Disposition', `inline; filename="payslip-${payslip.employee.employeeId}-${payslip.month}.pdf"`).send(buffer);
  }
}

export const hrPayrollController = new HrPayrollController();
