import ExcelJS from 'exceljs';

import { NotFoundError } from '../../../core/errors/app-error';
import { isDataUrl, presignGetUrl, uploadDataUrl } from '../../../core/storage/storage.service';
import { getTenantScopedClient } from '../../../infrastructure/database/tenant-scoped-client';
import { AuditLogRepository } from '../../authentication/repositories/audit-log.repository';
import type { IamActor } from '../../authentication/utils/actor.util';
import type { CreateExpenseInput, ExpenseDto, ListExpensesQuery, UpdateExpenseInput } from '../dto/finance.dto';
import { ExpenseRepository, type ExpenseRow } from '../repositories/expense.repository';

/** Receipts are financial records — private/ prefix, `receiptDataUrl` is a bare object key from creation on, presigned fresh on every read (same posture as MemberDocument). */
async function toDto(row: ExpenseRow): Promise<ExpenseDto> {
  return {
    id: row.id,
    category: row.category,
    amount: row.amount.toString(),
    expenseDate: row.expenseDate.toISOString().slice(0, 10),
    branch: row.branch ? { id: row.branch.id, name: row.branch.name } : null,
    description: row.description,
    receiptFileName: row.receiptFileName,
    receiptDataUrl: row.receiptDataUrl ? await presignGetUrl(row.receiptDataUrl) : row.receiptDataUrl,
    recordedBy: row.recordedByUser ? { id: row.recordedByUser.id, name: row.recordedByUser.name } : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: row.deletedAt?.toISOString() ?? null,
  };
}

function escapeCsv(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export class ExpenseService {
  private readonly expenses: ExpenseRepository;
  private readonly auditLog: AuditLogRepository;

  constructor(private readonly tenantId: string) {
    const db = getTenantScopedClient(tenantId);
    this.expenses = new ExpenseRepository(db);
    this.auditLog = new AuditLogRepository(db);
  }

  async list(query: ListExpensesQuery) {
    const { items, total } = await this.expenses.list(this.tenantId, query);
    return { items: await Promise.all(items.map(toDto)), total, page: query.page, limit: query.limit, totalPages: Math.max(1, Math.ceil(total / query.limit)) };
  }

  async getById(id: string): Promise<ExpenseDto> {
    return toDto(await this.mustFind(id));
  }

  async create(input: CreateExpenseInput, actor: IamActor): Promise<ExpenseDto> {
    const receiptDataUrl = isDataUrl(input.receiptDataUrl)
      ? await uploadDataUrl(input.receiptDataUrl, { keyPrefix: 'expense-receipts', visibility: 'private', accept: ['image', 'pdf'] })
      : input.receiptDataUrl;
    const expense = await this.expenses.create({
      tenantId: this.tenantId,
      category: input.category,
      amount: input.amount,
      expenseDate: new Date(input.expenseDate),
      branchId: input.branchId,
      description: input.description,
      receiptFileName: input.receiptFileName,
      receiptDataUrl,
      recordedBy: actor.userId,
    });
    await this.audit(actor, 'expense.created', expense.id);
    return toDto(expense);
  }

  async update(id: string, input: UpdateExpenseInput, actor: IamActor): Promise<ExpenseDto> {
    await this.mustFind(id);
    const receiptDataUrl = isDataUrl(input.receiptDataUrl)
      ? await uploadDataUrl(input.receiptDataUrl, { keyPrefix: 'expense-receipts', visibility: 'private', accept: ['image', 'pdf'] })
      : input.receiptDataUrl;
    await this.expenses.update(id, {
      category: input.category,
      amount: input.amount,
      expenseDate: input.expenseDate ? new Date(input.expenseDate) : undefined,
      branchId: input.branchId,
      description: input.description,
      receiptFileName: input.receiptFileName,
      receiptDataUrl,
    });
    await this.audit(actor, 'expense.updated', id);
    return this.getById(id);
  }

  async softDelete(id: string, actor: IamActor): Promise<void> {
    await this.mustFind(id);
    await this.expenses.softDelete(id);
    await this.audit(actor, 'expense.deleted', id);
  }

  async exportCsv(query: Partial<ListExpensesQuery>): Promise<string> {
    const { items } = await this.expenses.list(this.tenantId, {
      page: 1,
      limit: 10_000,
      includeDeleted: false,
      sortBy: 'expenseDate',
      sortDir: 'desc',
      ...query,
    });
    const header = 'Date,Category,Amount,Branch,Description,Receipt';
    const rows = items.map((row) =>
      [
        row.expenseDate.toISOString().slice(0, 10),
        row.category,
        row.amount.toString(),
        row.branch?.name ?? '',
        row.description ?? '',
        row.receiptFileName ?? '',
      ]
        .map((v) => escapeCsv(String(v)))
        .join(','),
    );
    return [header, ...rows].join('\n');
  }

  async exportExcel(query: Partial<ListExpensesQuery>): Promise<ExcelJS.Buffer> {
    const { items } = await this.expenses.list(this.tenantId, {
      page: 1,
      limit: 10_000,
      includeDeleted: false,
      sortBy: 'expenseDate',
      sortDir: 'desc',
      ...query,
    });
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Expenses');
    sheet.columns = [
      { header: 'Date', key: 'date', width: 14 },
      { header: 'Category', key: 'category', width: 20 },
      { header: 'Amount', key: 'amount', width: 14 },
      { header: 'Branch', key: 'branch', width: 20 },
      { header: 'Description', key: 'description', width: 40 },
      { header: 'Receipt', key: 'receipt', width: 24 },
    ];
    sheet.getRow(1).font = { bold: true };
    for (const row of items) {
      sheet.addRow({
        date: row.expenseDate.toISOString().slice(0, 10),
        category: row.category,
        amount: Number(row.amount),
        branch: row.branch?.name ?? '',
        description: row.description ?? '',
        receipt: row.receiptFileName ?? '',
      });
    }
    return workbook.xlsx.writeBuffer();
  }

  // ── internals ───────────────────────────────────────────────────────────

  private async mustFind(id: string, opts?: { includeDeleted?: boolean }): Promise<ExpenseRow> {
    const expense = await this.expenses.findById(this.tenantId, id, opts);
    if (!expense) throw new NotFoundError('Expense not found.');
    return expense;
  }

  private async audit(actor: IamActor, action: string, entityId: string): Promise<void> {
    await this.auditLog.record({
      tenantId: this.tenantId,
      actorUserId: actor.userId,
      actorRole: actor.role,
      action,
      entityType: 'expense',
      entityId,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });
  }
}
