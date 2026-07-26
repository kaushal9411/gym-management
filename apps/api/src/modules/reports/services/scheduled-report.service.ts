import type { Prisma, ReportFrequency } from '@prisma/client';

import { NotFoundError } from '../../../core/errors/app-error';
import { getTenantScopedClient, type TenantScopedPrisma } from '../../../infrastructure/database/tenant-scoped-client';
import { AuditLogRepository } from '../../authentication/repositories/audit-log.repository';
import type { IamActor } from '../../authentication/utils/actor.util';
import type { CreateScheduledReportInput, ScheduledReportDto, UpdateScheduledReportInput } from '../dto/reports.dto';
import { ScheduledReportRepository, type ScheduledReportRow } from '../repositories/scheduled-report.repository';
import { resolveBranchScope } from '../utils/branch-scope.util';

/** Next run time for a given frequency, anchored to `from` (defaults to now). Simple fixed-interval scheduling — no timezone-of-day precision, consistent with this codebase's other "every N hours" BullMQ sweeps. */
export function computeNextRunAt(frequency: ReportFrequency, from: Date = new Date()): Date {
  const next = new Date(from);
  if (frequency === 'DAILY') next.setUTCDate(next.getUTCDate() + 1);
  else if (frequency === 'WEEKLY') next.setUTCDate(next.getUTCDate() + 7);
  else next.setUTCMonth(next.getUTCMonth() + 1);
  return next;
}

function toDto(row: ScheduledReportRow): ScheduledReportDto {
  return {
    id: row.id,
    name: row.name,
    reportType: row.reportType,
    frequency: row.frequency,
    recipientEmails: row.recipientEmails,
    branch: row.branch ? { id: row.branch.id, name: row.branch.name } : null,
    filters: (row.filters as Record<string, unknown> | null) ?? null,
    isActive: row.isActive,
    lastRunAt: row.lastRunAt?.toISOString() ?? null,
    nextRunAt: row.nextRunAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export class ScheduledReportService {
  private readonly db: TenantScopedPrisma;
  private readonly schedules: ScheduledReportRepository;
  private readonly auditLog: AuditLogRepository;

  constructor(private readonly tenantId: string) {
    this.db = getTenantScopedClient(tenantId);
    this.schedules = new ScheduledReportRepository(this.db);
    this.auditLog = new AuditLogRepository(this.db);
  }

  async list(): Promise<ScheduledReportDto[]> {
    return (await this.schedules.list(this.tenantId)).map(toDto);
  }

  async getById(id: string): Promise<ScheduledReportDto> {
    return toDto(await this.mustFind(id));
  }

  async create(input: CreateScheduledReportInput, actor: IamActor): Promise<ScheduledReportDto> {
    // Validate branch access once, at creation time — the BullMQ sweep that
    // actually runs this schedule later has no live "current user" to check
    // against, so it trusts whatever branchId was authorized here.
    if (input.branchId) await resolveBranchScope(this.tenantId, actor.userId, input.branchId);

    const row = await this.schedules.create({
      tenantId: this.tenantId,
      name: input.name,
      reportType: input.reportType,
      frequency: input.frequency,
      recipientEmails: input.recipientEmails,
      branchId: input.branchId,
      filters: input.filters as Prisma.InputJsonValue | undefined,
      isActive: input.isActive ?? true,
      nextRunAt: computeNextRunAt(input.frequency),
      createdBy: actor.userId,
    });
    await this.audit(actor, 'scheduled_report.created', row.id);
    return toDto(row);
  }

  async update(id: string, input: UpdateScheduledReportInput, actor: IamActor): Promise<ScheduledReportDto> {
    const existing = await this.mustFind(id);
    const frequencyChanged = input.frequency && input.frequency !== existing.frequency;
    if (input.branchId) await resolveBranchScope(this.tenantId, actor.userId, input.branchId);

    await this.schedules.update(id, {
      name: input.name,
      reportType: input.reportType,
      frequency: input.frequency,
      recipientEmails: input.recipientEmails,
      branchId: input.branchId,
      filters: input.filters as Prisma.InputJsonValue | undefined,
      isActive: input.isActive,
      ...(frequencyChanged ? { nextRunAt: computeNextRunAt(input.frequency!) } : {}),
    });
    await this.audit(actor, 'scheduled_report.updated', id);
    return this.getById(id);
  }

  async delete(id: string, actor: IamActor): Promise<void> {
    await this.mustFind(id);
    await this.schedules.delete(id);
    await this.audit(actor, 'scheduled_report.deleted', id);
  }

  /** "Run now" — an on-demand trigger separate from the automatic schedule; just bumps lastRunAt/nextRunAt, the actual email send is delegated to the same job logic the BullMQ sweep uses. */
  async markRun(id: string): Promise<void> {
    const row = await this.mustFind(id);
    await this.schedules.update(id, { lastRunAt: new Date(), nextRunAt: computeNextRunAt(row.frequency) });
  }

  private async mustFind(id: string): Promise<ScheduledReportRow> {
    const row = await this.schedules.findById(this.tenantId, id);
    if (!row) throw new NotFoundError('Scheduled report not found.');
    return row;
  }

  private async audit(actor: IamActor, action: string, entityId: string): Promise<void> {
    await this.auditLog.record({
      tenantId: this.tenantId,
      actorUserId: actor.userId,
      actorRole: actor.role,
      action,
      entityType: 'scheduled_report',
      entityId,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });
  }
}
