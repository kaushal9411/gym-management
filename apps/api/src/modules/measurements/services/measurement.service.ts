import { NotFoundError } from '../../../core/errors/app-error';
import { getTenantScopedClient, type TenantScopedPrisma } from '../../../infrastructure/database/tenant-scoped-client';
import { AuditLogRepository } from '../../authentication/repositories/audit-log.repository';
import type { IamActor } from '../../authentication/utils/actor.util';
import type { BodyMeasurementDto, CreateBodyMeasurementInput, MeasuredMemberDto, UpdateBodyMeasurementInput } from '../dto/measurement.dto';
import { MeasurementRepository, type MeasurementRow } from '../repositories/measurement.repository';

function toDto(row: MeasurementRow): BodyMeasurementDto {
  return {
    id: row.id,
    memberId: row.memberId,
    recordedAt: row.recordedAt.toISOString(),
    weightKg: row.weightKg?.toString() ?? null,
    heightCm: row.heightCm?.toString() ?? null,
    bodyFatPercent: row.bodyFatPercent?.toString() ?? null,
    chestCm: row.chestCm?.toString() ?? null,
    waistCm: row.waistCm?.toString() ?? null,
    hipsCm: row.hipsCm?.toString() ?? null,
    bicepsCm: row.bicepsCm?.toString() ?? null,
    thighsCm: row.thighsCm?.toString() ?? null,
    notes: row.notes,
    recordedBy: row.recordedByUser ? { id: row.recordedByUser.id, name: row.recordedByUser.name } : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export class MeasurementService {
  private readonly db: TenantScopedPrisma;
  private readonly measurements: MeasurementRepository;
  private readonly auditLog: AuditLogRepository;

  constructor(private readonly tenantId: string) {
    this.db = getTenantScopedClient(tenantId);
    this.measurements = new MeasurementRepository(this.db);
    this.auditLog = new AuditLogRepository(this.db);
  }

  async listForMember(memberId: string): Promise<BodyMeasurementDto[]> {
    await this.mustFindMember(memberId);
    const rows = await this.measurements.list(this.tenantId, memberId);
    return rows.map(toDto);
  }

  /** Backs the "Body Measurements" list page — only members with real history, not the full roster. */
  async listMembersWithMeasurements(): Promise<MeasuredMemberDto[]> {
    const rows = await this.measurements.listMembersWithLatest(this.tenantId);
    return rows.map(({ row, count }) => ({
      member: {
        id: row.member.id,
        name: `${row.member.firstName} ${row.member.lastName}`.trim(),
        memberId: row.member.memberId,
        profilePhotoUrl: row.member.profilePhotoUrl,
        branch: { id: row.member.branch.id, name: row.member.branch.name },
        trainer: row.member.trainer ? { id: row.member.trainer.id, name: row.member.trainer.name } : null,
      },
      latest: toDto(row),
      count,
    }));
  }

  async create(memberId: string, input: CreateBodyMeasurementInput, actor: IamActor): Promise<BodyMeasurementDto> {
    await this.mustFindMember(memberId);
    const recordedAt = input.recordedAt ? new Date(input.recordedAt) : new Date();
    if (Number.isNaN(recordedAt.getTime())) throw new NotFoundError('Invalid recorded date.');

    const row = await this.measurements.create({
      tenantId: this.tenantId,
      memberId,
      recordedAt,
      weightKg: input.weightKg,
      heightCm: input.heightCm,
      bodyFatPercent: input.bodyFatPercent,
      chestCm: input.chestCm,
      waistCm: input.waistCm,
      hipsCm: input.hipsCm,
      bicepsCm: input.bicepsCm,
      thighsCm: input.thighsCm,
      notes: input.notes,
      recordedBy: actor.userId,
    });
    await this.audit(actor, 'measurement.created', memberId);
    return toDto(row);
  }

  async update(id: string, input: UpdateBodyMeasurementInput, actor: IamActor): Promise<BodyMeasurementDto> {
    const existing = await this.mustFind(id);
    const recordedAt = input.recordedAt ? new Date(input.recordedAt) : undefined;
    if (recordedAt && Number.isNaN(recordedAt.getTime())) throw new NotFoundError('Invalid recorded date.');

    const row = await this.measurements.update(id, {
      ...(recordedAt ? { recordedAt } : {}),
      ...(input.weightKg !== undefined ? { weightKg: input.weightKg } : {}),
      ...(input.heightCm !== undefined ? { heightCm: input.heightCm } : {}),
      ...(input.bodyFatPercent !== undefined ? { bodyFatPercent: input.bodyFatPercent } : {}),
      ...(input.chestCm !== undefined ? { chestCm: input.chestCm } : {}),
      ...(input.waistCm !== undefined ? { waistCm: input.waistCm } : {}),
      ...(input.hipsCm !== undefined ? { hipsCm: input.hipsCm } : {}),
      ...(input.bicepsCm !== undefined ? { bicepsCm: input.bicepsCm } : {}),
      ...(input.thighsCm !== undefined ? { thighsCm: input.thighsCm } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
    });
    await this.audit(actor, 'measurement.updated', existing.memberId);
    return toDto(row);
  }

  async delete(id: string, actor: IamActor): Promise<void> {
    const existing = await this.mustFind(id);
    await this.measurements.delete(id);
    await this.audit(actor, 'measurement.deleted', existing.memberId);
  }

  /** Self-service read for the member-portal plane — no RBAC, caller already proved `memberId` is their own via `req.memberAuth.sub`. */
  async listForSelf(memberId: string): Promise<BodyMeasurementDto[]> {
    const rows = await this.measurements.list(this.tenantId, memberId);
    return rows.map(toDto);
  }

  private async mustFind(id: string): Promise<MeasurementRow> {
    const row = await this.measurements.findById(this.tenantId, id);
    if (!row) throw new NotFoundError('Measurement entry not found.');
    return row;
  }

  private async mustFindMember(memberId: string): Promise<void> {
    const member = await this.db.member.findFirst({ where: { tenantId: this.tenantId, id: memberId, deletedAt: null } });
    if (!member) throw new NotFoundError('Member not found.');
  }

  private async audit(actor: IamActor, action: string, entityId: string): Promise<void> {
    await this.auditLog.record({
      tenantId: this.tenantId,
      actorUserId: actor.userId,
      actorRole: actor.role,
      action,
      entityType: 'body_measurement',
      entityId,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });
  }
}
