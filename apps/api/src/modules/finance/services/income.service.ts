import ExcelJS from 'exceljs';

import { NotFoundError } from '../../../core/errors/app-error';
import { getTenantScopedClient } from '../../../infrastructure/database/tenant-scoped-client';
import { AuditLogRepository } from '../../authentication/repositories/audit-log.repository';
import type { IamActor } from '../../authentication/utils/actor.util';
import type { CreateIncomeInput, IncomeDto, ListIncomeQuery, UpdateIncomeInput } from '../dto/finance.dto';
import { IncomeRepository, type IncomeRow } from '../repositories/income.repository';

function toDto(row: IncomeRow): IncomeDto {
  return {
    id: row.id,
    category: row.category,
    amount: row.amount.toString(),
    incomeDate: row.incomeDate.toISOString().slice(0, 10),
    branch: row.branch ? { id: row.branch.id, name: row.branch.name } : null,
    description: row.description,
    sourcePaymentId: row.sourcePaymentId,
    recordedBy: row.recordedByUser ? { id: row.recordedByUser.id, name: row.recordedByUser.name } : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: row.deletedAt?.toISOString() ?? null,
  };
}

function escapeCsv(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export class IncomeService {
  private readonly income: IncomeRepository;
  private readonly auditLog: AuditLogRepository;

  constructor(private readonly tenantId: string) {
    const db = getTenantScopedClient(tenantId);
    this.income = new IncomeRepository(db);
    this.auditLog = new AuditLogRepository(db);
  }

  async list(query: ListIncomeQuery) {
    const { items, total } = await this.income.list(this.tenantId, query);
    return { items: items.map(toDto), total, page: query.page, limit: query.limit, totalPages: Math.max(1, Math.ceil(total / query.limit)) };
  }

  async getById(id: string): Promise<IncomeDto> {
    return toDto(await this.mustFind(id));
  }

  async create(input: CreateIncomeInput, actor: IamActor): Promise<IncomeDto> {
    const income = await this.income.create({
      tenantId: this.tenantId,
      category: input.category,
      amount: input.amount,
      incomeDate: new Date(input.incomeDate),
      branchId: input.branchId,
      description: input.description,
      recordedBy: actor.userId,
    });
    await this.audit(actor, 'income.created', income.id);
    return toDto(income);
  }

  async update(id: string, input: UpdateIncomeInput, actor: IamActor): Promise<IncomeDto> {
    const existing = await this.mustFind(id);
    if (existing.sourcePaymentId) {
      throw new NotFoundError('This income entry was auto-generated from a payment and cannot be edited directly.');
    }
    await this.income.update(id, {
      category: input.category,
      amount: input.amount,
      incomeDate: input.incomeDate ? new Date(input.incomeDate) : undefined,
      branchId: input.branchId,
      description: input.description,
    });
    await this.audit(actor, 'income.updated', id);
    return this.getById(id);
  }

  async softDelete(id: string, actor: IamActor): Promise<void> {
    const existing = await this.mustFind(id);
    if (existing.sourcePaymentId) {
      throw new NotFoundError('This income entry was auto-generated from a payment and cannot be deleted directly.');
    }
    await this.income.softDelete(id);
    await this.audit(actor, 'income.deleted', id);
  }

  async exportCsv(query: Partial<ListIncomeQuery>): Promise<string> {
    const { items } = await this.income.list(this.tenantId, {
      page: 1,
      limit: 10_000,
      includeDeleted: false,
      sortBy: 'incomeDate',
      sortDir: 'desc',
      ...query,
    });
    const header = 'Date,Category,Amount,Branch,Description';
    const rows = items.map((row) =>
      [row.incomeDate.toISOString().slice(0, 10), row.category, row.amount.toString(), row.branch?.name ?? '', row.description ?? '']
        .map((v) => escapeCsv(String(v)))
        .join(','),
    );
    return [header, ...rows].join('\n');
  }

  async exportExcel(query: Partial<ListIncomeQuery>): Promise<ExcelJS.Buffer> {
    const { items } = await this.income.list(this.tenantId, {
      page: 1,
      limit: 10_000,
      includeDeleted: false,
      sortBy: 'incomeDate',
      sortDir: 'desc',
      ...query,
    });
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Income');
    sheet.columns = [
      { header: 'Date', key: 'date', width: 14 },
      { header: 'Category', key: 'category', width: 20 },
      { header: 'Amount', key: 'amount', width: 14 },
      { header: 'Branch', key: 'branch', width: 20 },
      { header: 'Description', key: 'description', width: 40 },
    ];
    sheet.getRow(1).font = { bold: true };
    for (const row of items) {
      sheet.addRow({
        date: row.incomeDate.toISOString().slice(0, 10),
        category: row.category,
        amount: Number(row.amount),
        branch: row.branch?.name ?? '',
        description: row.description ?? '',
      });
    }
    return workbook.xlsx.writeBuffer();
  }

  // ── internals ───────────────────────────────────────────────────────────

  private async mustFind(id: string, opts?: { includeDeleted?: boolean }): Promise<IncomeRow> {
    const income = await this.income.findById(this.tenantId, id, opts);
    if (!income) throw new NotFoundError('Income entry not found.');
    return income;
  }

  private async audit(actor: IamActor, action: string, entityId: string): Promise<void> {
    await this.auditLog.record({
      tenantId: this.tenantId,
      actorUserId: actor.userId,
      actorRole: actor.role,
      action,
      entityType: 'income',
      entityId,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });
  }
}
