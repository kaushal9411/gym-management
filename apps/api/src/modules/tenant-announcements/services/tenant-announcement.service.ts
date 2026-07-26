import { ConflictError, NotFoundError } from '../../../core/errors/app-error';
import { ErrorCode } from '../../../core/errors/error-codes';
import { getTenantScopedClient, type TenantScopedPrisma } from '../../../infrastructure/database/tenant-scoped-client';
import { AuditLogRepository } from '../../authentication/repositories/audit-log.repository';
import type { IamActor } from '../../authentication/utils/actor.util';
import { notifyAnnouncementPublished } from '../../tenant-notifications/services/notification-trigger.service';
import type {
  CreateTenantAnnouncementInput,
  ListAnnouncementsQuery,
  ScheduleAnnouncementInput,
  TenantAnnouncementDto,
  UpdateTenantAnnouncementInput,
} from '../dto/tenant-announcement.dto';
import { TenantAnnouncementRepository, type TenantAnnouncementRow } from '../repositories/tenant-announcement.repository';

/** Rich-text body is stored as HTML; the Notification Center feed item is plain text. */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function toDto(row: TenantAnnouncementRow): TenantAnnouncementDto {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    audience: row.audience,
    status: row.status,
    branch: row.branch ? { id: row.branch.id, name: row.branch.name } : null,
    publishAt: row.publishAt?.toISOString() ?? null,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    expiresAt: row.expiresAt?.toISOString() ?? null,
    createdBy: { id: row.createdByUser.id, name: row.createdByUser.name },
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export class TenantAnnouncementService {
  private readonly db: TenantScopedPrisma;
  private readonly announcements: TenantAnnouncementRepository;
  private readonly auditLog: AuditLogRepository;

  constructor(private readonly tenantId: string) {
    this.db = getTenantScopedClient(tenantId);
    this.announcements = new TenantAnnouncementRepository(this.db);
    this.auditLog = new AuditLogRepository(this.db);
  }

  async list(query: ListAnnouncementsQuery) {
    const skip = (query.page - 1) * query.limit;
    const { total, items } = await this.announcements.list(this.tenantId, { status: query.status, skip, take: query.limit });
    return { items: items.map(toDto), total, page: query.page, limit: query.limit, totalPages: Math.max(1, Math.ceil(total / query.limit)) };
  }

  async getById(id: string): Promise<TenantAnnouncementDto> {
    return toDto(await this.mustFind(id));
  }

  async create(input: CreateTenantAnnouncementInput, actor: IamActor): Promise<TenantAnnouncementDto> {
    if (input.branchId) await this.assertBranchExists(input.branchId);

    const row = await this.announcements.create({
      tenantId: this.tenantId,
      title: input.title,
      body: input.body,
      audience: input.audience ?? 'ALL',
      branchId: input.branchId,
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined,
      createdBy: actor.userId,
    });
    await this.audit(actor, 'tenant_announcement.created', row.id);
    return toDto(row);
  }

  async update(id: string, input: UpdateTenantAnnouncementInput, actor: IamActor): Promise<TenantAnnouncementDto> {
    const existing = await this.mustFind(id);
    if (existing.status === 'PUBLISHED' || existing.status === 'EXPIRED') {
      throw new ConflictError(ErrorCode.CONFLICT, 'A published or expired announcement cannot be edited — delete it and create a new one instead.');
    }
    if (input.branchId) await this.assertBranchExists(input.branchId);

    await this.announcements.update(id, {
      title: input.title,
      body: input.body,
      audience: input.audience,
      branchId: input.branchId,
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined,
    });
    await this.audit(actor, 'tenant_announcement.updated', id);
    return this.getById(id);
  }

  async delete(id: string, actor: IamActor): Promise<void> {
    await this.mustFind(id);
    await this.announcements.delete(id);
    await this.audit(actor, 'tenant_announcement.deleted', id);
  }

  /** Publish immediately — from DRAFT or SCHEDULED (a scheduled announcement can be published early). */
  async publish(id: string, actor: IamActor): Promise<TenantAnnouncementDto> {
    const existing = await this.mustFind(id);
    if (existing.status === 'PUBLISHED' || existing.status === 'EXPIRED') {
      throw new ConflictError(ErrorCode.CONFLICT, 'This announcement has already been published.');
    }
    const now = new Date();
    await this.announcements.update(id, { status: 'PUBLISHED', publishAt: null, publishedAt: now });
    await this.audit(actor, 'tenant_announcement.published', id);
    await notifyAnnouncementPublished(this.tenantId, { title: existing.title, body: stripHtml(existing.body) });
    return this.getById(id);
  }

  /** "Schedule Announcement" — sets a future auto-publish time; the BullMQ sweep (`jobs/tenant-announcement-scheduler.jobs.ts`) publishes it once due. */
  async schedule(id: string, input: ScheduleAnnouncementInput, actor: IamActor): Promise<TenantAnnouncementDto> {
    const existing = await this.mustFind(id);
    if (existing.status === 'PUBLISHED' || existing.status === 'EXPIRED') {
      throw new ConflictError(ErrorCode.CONFLICT, 'This announcement has already been published.');
    }
    await this.announcements.update(id, { status: 'SCHEDULED', publishAt: new Date(input.publishAt) });
    await this.audit(actor, 'tenant_announcement.scheduled', id);
    return this.getById(id);
  }

  private async assertBranchExists(branchId: string): Promise<void> {
    const branch = await this.db.branch.findFirst({ where: { tenantId: this.tenantId, id: branchId } });
    if (!branch) throw new NotFoundError('Branch not found.');
  }

  private async mustFind(id: string): Promise<TenantAnnouncementRow> {
    const row = await this.announcements.findById(this.tenantId, id);
    if (!row) throw new NotFoundError('Announcement not found.');
    return row;
  }

  private async audit(actor: IamActor, action: string, entityId: string): Promise<void> {
    await this.auditLog.record({
      tenantId: this.tenantId,
      actorUserId: actor.userId,
      actorRole: actor.role,
      action,
      entityType: 'tenant_announcement',
      entityId,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });
  }
}
