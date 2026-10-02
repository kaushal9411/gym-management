import type { Prisma } from '@prisma/client';

import type { TenantScopedPrisma } from '../../../infrastructure/database/tenant-scoped-client';
import type { ListAttendanceDevicesQuery } from '../dto/attendance-device.dto';

const DEVICE_INCLUDE = {
  branch: { select: { id: true, name: true } },
} satisfies Prisma.AttendanceDeviceInclude;

export type AttendanceDeviceRow = Prisma.AttendanceDeviceGetPayload<{ include: typeof DEVICE_INCLUDE }>;

export class AttendanceDeviceRepository {
  constructor(private readonly db: TenantScopedPrisma) {}

  async list(tenantId: string, query: ListAttendanceDevicesQuery): Promise<AttendanceDeviceRow[]> {
    return this.db.attendanceDevice.findMany({
      where: {
        tenantId,
        deletedAt: null,
        ...(query.branchId ? { branchId: query.branchId } : {}),
        ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
      },
      include: DEVICE_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(tenantId: string, id: string): Promise<AttendanceDeviceRow | null> {
    return this.db.attendanceDevice.findFirst({ where: { tenantId, id, deletedAt: null }, include: DEVICE_INCLUDE });
  }

  /** Scoped to the already-resolved tenant (the device calls its own tenant's subdomain, same as every other client) — no cross-tenant lookup needed. */
  async findByApiKeyHash(tenantId: string, apiKeyHash: string): Promise<AttendanceDeviceRow | null> {
    return this.db.attendanceDevice.findFirst({ where: { tenantId, apiKeyHash, deletedAt: null }, include: DEVICE_INCLUDE });
  }

  async create(data: Prisma.AttendanceDeviceUncheckedCreateInput): Promise<AttendanceDeviceRow> {
    const device = await this.db.attendanceDevice.create({ data });
    return (await this.findById(data.tenantId, device.id))!;
  }

  async update(id: string, data: Prisma.AttendanceDeviceUncheckedUpdateInput): Promise<void> {
    await this.db.attendanceDevice.update({ where: { id }, data });
  }

  async touchLastSeen(id: string): Promise<void> {
    await this.db.attendanceDevice.update({ where: { id }, data: { lastSeenAt: new Date() } });
  }

  async softDelete(id: string): Promise<void> {
    await this.db.attendanceDevice.update({ where: { id }, data: { deletedAt: new Date() } });
  }
}
