import type { Request, Response } from 'express';

import { sendSuccess } from '../../../core/http/response';
import { actorFrom } from '../../authentication/utils/actor.util';
import type { CreateIncomeInput, ListIncomeQuery, UpdateIncomeInput } from '../dto/finance.dto';
import { IncomeService } from '../services/income.service';

function serviceFor(req: Request): IncomeService {
  return new IncomeService(req.tenant!.id);
}

export class IncomeController {
  async list(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await serviceFor(req).list(req.query as unknown as ListIncomeQuery));
  }

  async getById(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await serviceFor(req).getById(req.params.id!));
  }

  async create(req: Request, res: Response): Promise<void> {
    const income = await serviceFor(req).create(req.body as CreateIncomeInput, actorFrom(req));
    sendSuccess(res, income, 'Income recorded.', 201);
  }

  async update(req: Request, res: Response): Promise<void> {
    const income = await serviceFor(req).update(req.params.id!, req.body as UpdateIncomeInput, actorFrom(req));
    sendSuccess(res, income, 'Income updated.');
  }

  async softDelete(req: Request, res: Response): Promise<void> {
    await serviceFor(req).softDelete(req.params.id!, actorFrom(req));
    sendSuccess(res, null, 'Income deleted.');
  }

  async exportCsv(req: Request, res: Response): Promise<void> {
    const csv = await serviceFor(req).exportCsv(req.query as unknown as Partial<ListIncomeQuery>);
    res
      .status(200)
      .setHeader('Content-Type', 'text/csv; charset=utf-8')
      .setHeader('Content-Disposition', `attachment; filename="income-export-${new Date().toISOString().slice(0, 10)}.csv"`)
      .send(csv);
  }

  async exportExcel(req: Request, res: Response): Promise<void> {
    const buffer = await serviceFor(req).exportExcel(req.query as unknown as Partial<ListIncomeQuery>);
    res
      .status(200)
      .setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      .setHeader('Content-Disposition', `attachment; filename="income-export-${new Date().toISOString().slice(0, 10)}.xlsx"`)
      .send(Buffer.from(buffer));
  }
}

export const incomeController = new IncomeController();
