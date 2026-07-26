import type { Request, Response } from 'express';

import { sendSuccess } from '../../../core/http/response';
import { actorFrom } from '../../authentication/utils/actor.util';
import type { CreatePaymentInput, ListPaymentsQuery, RefundPaymentInput, UpdatePaymentInput } from '../dto/finance.dto';
import { MemberPaymentService } from '../services/member-payment.service';

function serviceFor(req: Request): MemberPaymentService {
  return new MemberPaymentService(req.tenant!.id);
}

export class MemberPaymentController {
  async list(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await serviceFor(req).list(req.query as unknown as ListPaymentsQuery));
  }

  async getById(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await serviceFor(req).getById(req.params.id!));
  }

  async create(req: Request, res: Response): Promise<void> {
    const payment = await serviceFor(req).create(req.body as CreatePaymentInput, actorFrom(req));
    sendSuccess(res, payment, 'Payment recorded.', 201);
  }

  async update(req: Request, res: Response): Promise<void> {
    const payment = await serviceFor(req).update(req.params.id!, req.body as UpdatePaymentInput, actorFrom(req));
    sendSuccess(res, payment, 'Payment updated.');
  }

  async cancel(req: Request, res: Response): Promise<void> {
    await serviceFor(req).cancel(req.params.id!, actorFrom(req));
    sendSuccess(res, null, 'Payment cancelled.');
  }

  async verifyStatus(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await serviceFor(req).verifyStatus(req.params.id!));
  }

  async refund(req: Request, res: Response): Promise<void> {
    const payment = await serviceFor(req).refund(req.params.id!, req.body as RefundPaymentInput, actorFrom(req));
    sendSuccess(res, payment, 'Refund recorded.');
  }

  async exportCsv(req: Request, res: Response): Promise<void> {
    const csv = await serviceFor(req).exportCsv(req.query as unknown as Partial<ListPaymentsQuery>);
    res
      .status(200)
      .setHeader('Content-Type', 'text/csv; charset=utf-8')
      .setHeader('Content-Disposition', `attachment; filename="payments-export-${new Date().toISOString().slice(0, 10)}.csv"`)
      .send(csv);
  }

  async exportExcel(req: Request, res: Response): Promise<void> {
    const buffer = await serviceFor(req).exportExcel(req.query as unknown as Partial<ListPaymentsQuery>);
    res
      .status(200)
      .setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      .setHeader('Content-Disposition', `attachment; filename="payments-export-${new Date().toISOString().slice(0, 10)}.xlsx"`)
      .send(Buffer.from(buffer));
  }
}

export const memberPaymentController = new MemberPaymentController();
