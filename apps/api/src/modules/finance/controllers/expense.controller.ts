import type { Request, Response } from 'express';

import { sendSuccess } from '../../../core/http/response';
import { actorFrom } from '../../authentication/utils/actor.util';
import type { CreateExpenseInput, ListExpensesQuery, UpdateExpenseInput } from '../dto/finance.dto';
import { ExpenseService } from '../services/expense.service';

function serviceFor(req: Request): ExpenseService {
  return new ExpenseService(req.tenant!.id);
}

export class ExpenseController {
  async list(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await serviceFor(req).list(req.query as unknown as ListExpensesQuery, req.auth!.sub));
  }

  async getById(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await serviceFor(req).getById(req.params.id!, req.auth!.sub));
  }

  async create(req: Request, res: Response): Promise<void> {
    const expense = await serviceFor(req).create(req.body as CreateExpenseInput, actorFrom(req));
    sendSuccess(res, expense, 'Expense recorded.', 201);
  }

  async update(req: Request, res: Response): Promise<void> {
    const expense = await serviceFor(req).update(req.params.id!, req.body as UpdateExpenseInput, actorFrom(req));
    sendSuccess(res, expense, 'Expense updated.');
  }

  async softDelete(req: Request, res: Response): Promise<void> {
    await serviceFor(req).softDelete(req.params.id!, actorFrom(req));
    sendSuccess(res, null, 'Expense deleted.');
  }

  async exportCsv(req: Request, res: Response): Promise<void> {
    const csv = await serviceFor(req).exportCsv(req.query as unknown as Partial<ListExpensesQuery>, req.auth!.sub);
    res
      .status(200)
      .setHeader('Content-Type', 'text/csv; charset=utf-8')
      .setHeader('Content-Disposition', `attachment; filename="expenses-export-${new Date().toISOString().slice(0, 10)}.csv"`)
      .send(csv);
  }

  async exportExcel(req: Request, res: Response): Promise<void> {
    const buffer = await serviceFor(req).exportExcel(req.query as unknown as Partial<ListExpensesQuery>, req.auth!.sub);
    res
      .status(200)
      .setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      .setHeader('Content-Disposition', `attachment; filename="expenses-export-${new Date().toISOString().slice(0, 10)}.xlsx"`)
      .send(Buffer.from(buffer));
  }
}

export const expenseController = new ExpenseController();
