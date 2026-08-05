import { ConflictError, NotFoundError } from '../../../core/errors/app-error';
import { AppError } from '../../../core/errors/app-error';
import { ErrorCode } from '../../../core/errors/error-codes';
import { getTenantScopedClient, type TenantScopedPrisma } from '../../../infrastructure/database/tenant-scoped-client';
import { AuditLogRepository } from '../../authentication/repositories/audit-log.repository';
import type { IamActor } from '../../authentication/utils/actor.util';
import type { CreateGroupClassInput, GroupClassDto, ListGroupClassesQuery, ScheduleSlotInput, UpdateGroupClassInput } from '../dto/classes.dto';
import { GroupClassRepository, type GroupClassRow } from '../repositories/group-class.repository';

function toDto(row: GroupClassRow): GroupClassDto {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    trainer: row.trainer ? { id: row.trainer.id, name: row.trainer.name } : null,
    branch: { id: row.branch.id, name: row.branch.name },
    capacity: row.capacity,
    durationMinutes: row.durationMinutes,
    isActive: row.isActive,
    schedule: row.schedule.map((s) => ({ dayOfWeek: s.dayOfWeek, startTime: s.startTime })),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: row.deletedAt?.toISOString() ?? null,
  };
}

export class GroupClassService {
  private readonly db: TenantScopedPrisma;
  private readonly classes: GroupClassRepository;
  private readonly auditLog: AuditLogRepository;

  constructor(private readonly tenantId: string) {
    this.db = getTenantScopedClient(tenantId);
    this.classes = new GroupClassRepository(this.db);
    this.auditLog = new AuditLogRepository(this.db);
  }

  async list(query: ListGroupClassesQuery) {
    const { items, total } = await this.classes.list(this.tenantId, query);
    return { items: items.map(toDto), total, page: query.page, limit: query.limit, totalPages: Math.max(1, Math.ceil(total / query.limit)) };
  }

  async listActive(): Promise<GroupClassDto[]> {
    return (await this.classes.listActive(this.tenantId)).map(toDto);
  }

  async getById(id: string): Promise<GroupClassDto> {
    return toDto(await this.mustFind(id));
  }

  async create(input: CreateGroupClassInput, actor: IamActor): Promise<GroupClassDto> {
    await this.assertBranchExists(input.branchId);
    if (input.trainerId) await this.assertTrainerActive(input.trainerId);
    await this.assertNameAvailable(input.branchId, input.name);

    const row = await this.classes.create({
      tenantId: this.tenantId,
      name: input.name,
      description: input.description,
      trainerId: input.trainerId,
      branchId: input.branchId,
      capacity: input.capacity,
      durationMinutes: input.durationMinutes,
      isActive: input.isActive ?? true,
    });
    await this.audit(actor, 'group_class.created', row.id);
    return toDto(row);
  }

  async update(id: string, input: UpdateGroupClassInput, actor: IamActor): Promise<GroupClassDto> {
    const existing = await this.mustFind(id);
    if (input.branchId) await this.assertBranchExists(input.branchId);
    if (input.trainerId) await this.assertTrainerActive(input.trainerId);
    if (input.name && input.name.toLowerCase() !== existing.name.toLowerCase()) {
      await this.assertNameAvailable(input.branchId ?? existing.branchId, input.name);
    }

    await this.classes.update(id, {
      name: input.name,
      description: input.description,
      trainerId: input.trainerId,
      branchId: input.branchId,
      capacity: input.capacity,
      durationMinutes: input.durationMinutes,
      isActive: input.isActive,
    });
    await this.audit(actor, 'group_class.updated', id);
    return this.getById(id);
  }

  async setSchedule(id: string, slots: ScheduleSlotInput[], actor: IamActor): Promise<GroupClassDto> {
    await this.mustFind(id);
    await this.classes.replaceSchedule(this.tenantId, id, slots);
    await this.audit(actor, 'group_class.schedule_updated', id);
    return this.getById(id);
  }

  async softDelete(id: string, actor: IamActor): Promise<void> {
    await this.mustFind(id);
    await this.classes.softDelete(id);
    await this.audit(actor, 'group_class.deleted', id);
  }

  async restore(id: string, actor: IamActor): Promise<void> {
    await this.mustFind(id, { includeDeleted: true });
    await this.classes.restore(id);
    await this.audit(actor, 'group_class.restored', id);
  }

  // ── internals ───────────────────────────────────────────────────────────

  private async mustFind(id: string, opts?: { includeDeleted?: boolean }): Promise<GroupClassRow> {
    const row = await this.classes.findById(this.tenantId, id, opts);
    if (!row) throw new NotFoundError('Class not found.');
    return row;
  }

  private async assertNameAvailable(branchId: string, name: string): Promise<void> {
    const existing = await this.classes.findByName(this.tenantId, branchId, name);
    if (existing) throw new ConflictError(ErrorCode.CONFLICT, `A class named "${name}" already exists at this branch.`);
  }

  private async assertBranchExists(branchId: string): Promise<void> {
    const found = await this.db.branch.count({ where: { id: branchId, tenantId: this.tenantId, isActive: true } });
    if (found === 0) throw new NotFoundError('Selected branch does not exist or is inactive.');
  }

  /** Same business rule as WorkoutPlan/DietPlan: only active trainers can be assigned. */
  private async assertTrainerActive(trainerId: string): Promise<void> {
    const trainer = await this.db.user.findFirst({
      where: { id: trainerId, tenantId: this.tenantId, deletedAt: null, userRoles: { some: { role: { name: 'TRAINER' } } } },
    });
    if (!trainer) throw new NotFoundError('Selected trainer does not exist or is not a Trainer.');
    if (trainer.status !== 'ACTIVE') throw new AppError(ErrorCode.CONFLICT, 'Only active trainers can be assigned to a class.', 409);
  }

  private async audit(actor: IamActor, action: string, entityId: string): Promise<void> {
    await this.auditLog.record({ tenantId: this.tenantId, actorUserId: actor.userId, actorRole: actor.role, action, entityType: 'group_class', entityId, ipAddress: actor.ipAddress, userAgent: actor.userAgent });
  }
}
