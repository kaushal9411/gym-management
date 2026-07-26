import type { Request, Response } from 'express';

import { sendSuccess } from '../../../core/http/response';
import { actorFrom } from '../../authentication/utils/actor.util';
import type { GenerateInvoiceInput, ListInvoicesQuery } from '../dto/finance.dto';
import { MemberInvoiceService } from '../services/member-invoice.service';

function serviceFor(req: Request): MemberInvoiceService {
  return new MemberInvoiceService(req.tenant!.id);
}

export class MemberInvoiceController {
  async list(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await serviceFor(req).list(req.query as unknown as ListInvoicesQuery));
  }

  async getById(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await serviceFor(req).getById(req.params.id!));
  }

  async generate(req: Request, res: Response): Promise<void> {
    const invoice = await serviceFor(req).generate(req.body as GenerateInvoiceInput, actorFrom(req));
    sendSuccess(res, invoice, 'Invoice generated.', 201);
  }

  async downloadPdf(req: Request, res: Response): Promise<void> {
    const buffer = await serviceFor(req).renderPdf(req.params.id!, req.tenant!.name);
    res
      .status(200)
      .setHeader('Content-Type', 'application/pdf')
      .setHeader('Content-Disposition', `attachment; filename="invoice-${req.params.id}.pdf"`)
      .send(buffer);
  }

  async email(req: Request, res: Response): Promise<void> {
    const { email } = req.body as { email?: string };
    await serviceFor(req).email(req.params.id!, actorFrom(req), email);
    sendSuccess(res, null, 'Invoice emailed.');
  }
}

export const memberInvoiceController = new MemberInvoiceController();
