import { NotFoundError } from '../../../core/errors/app-error';
import { generateOpaqueToken, hashToken } from '../../../core/security/token.util';
import { getTenantScopedClient, type TenantScopedPrisma } from '../../../infrastructure/database/tenant-scoped-client';
import { AuditLogRepository } from '../../authentication/repositories/audit-log.repository';
import type { IamActor } from '../../authentication/utils/actor.util';
import type {
  AttendanceDeviceDto,
  AttendanceDeviceWithKeyDto,
  CreateAttendanceDeviceInput,
  ListAttendanceDevicesQuery,
  UpdateAttendanceDeviceInput,
} from '../dto/attendance-device.dto';
import { AttendanceDeviceRepository, type AttendanceDeviceRow } from '../repositories/attendance-device.repository';

function toDto(row: AttendanceDeviceRow): AttendanceDeviceDto {
  return {
    id: row.id,
    branchId: row.branchId,
    branchName: row.branch.name,
    name: row.name,
    vendor: row.vendor,
    isActive: row.isActive,
    lastSeenAt: row.lastSeenAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export class AttendanceDeviceService {
  private readonly db: TenantScopedPrisma;
  private readonly devices: AttendanceDeviceRepository;
  private readonly auditLog: AuditLogRepository;

  constructor(private readonly tenantId: string) {
    this.db = getTenantScopedClient(tenantId);
    this.devices = new AttendanceDeviceRepository(this.db);
    this.auditLog = new AuditLogRepository(this.db);
  }

  async list(query: ListAttendanceDevicesQuery): Promise<AttendanceDeviceDto[]> {
    return (await this.devices.list(this.tenantId, query)).map(toDto);
  }

  async getById(id: string): Promise<AttendanceDeviceDto> {
    return toDto(await this.mustFind(id));
  }

  /** The plaintext key is returned exactly once — only its SHA-256 hash is ever persisted (same shape as refresh tokens, `core/security/token.util.ts`). */
  async create(input: CreateAttendanceDeviceInput, actor: IamActor): Promise<AttendanceDeviceWithKeyDto> {
    const apiKey = generateOpaqueToken();
    const device = await this.devices.create({
      tenantId: this.tenantId,
      branchId: input.branchId,
      name: input.name,
      vendor: input.vendor ?? 'GENERIC',
      apiKeyHash: hashToken(apiKey),
    });
    await this.audit(actor, 'attendance_device.created', device.id);
    return { ...toDto(device), apiKey };
  }

  async update(id: string, input: UpdateAttendanceDeviceInput, actor: IamActor): Promise<AttendanceDeviceDto> {
    await this.mustFind(id);
    await this.devices.update(id, { name: input.name, vendor: input.vendor, isActive: input.isActive });
    await this.audit(actor, 'attendance_device.updated', id);
    return this.getById(id);
  }

  /** Invalidates the old key immediately — a lost/compromised device credential can always be rotated without deleting the device record (and its history) outright. */
  async regenerateKey(id: string, actor: IamActor): Promise<AttendanceDeviceWithKeyDto> {
    const existing = await this.mustFind(id);
    const apiKey = generateOpaqueToken();
    await this.devices.update(id, { apiKeyHash: hashToken(apiKey) });
    await this.audit(actor, 'attendance_device.key_regenerated', id);
    return { ...toDto(existing), apiKey };
  }

  async softDelete(id: string, actor: IamActor): Promise<void> {
    await this.mustFind(id);
    await this.devices.softDelete(id);
    await this.audit(actor, 'attendance_device.deleted', id);
  }

  private async mustFind(id: string): Promise<AttendanceDeviceRow> {
    const device = await this.devices.findById(this.tenantId, id);
    if (!device) throw new NotFoundError('Attendance device not found.');
    return device;
  }

  private async audit(actor: IamActor, action: string, entityId: string): Promise<void> {
    await this.auditLog.record({
      tenantId: this.tenantId,
      actorUserId: actor.userId,
      actorRole: actor.role,
      action,
      entityType: 'AttendanceDevice',
      entityId,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });
  }
}
