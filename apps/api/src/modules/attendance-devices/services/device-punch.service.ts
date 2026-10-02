import { ConflictError, NotFoundError } from '../../../core/errors/app-error';
import { ErrorCode } from '../../../core/errors/error-codes';
import { getTenantScopedClient, type TenantScopedPrisma } from '../../../infrastructure/database/tenant-scoped-client';
import { emitToTenant } from '../../../infrastructure/realtime/socket-server';
import type { AttendanceRecordDto } from '../../attendance/dto/attendance.dto';
import { AttendanceRepository, type AttendanceRow } from '../../attendance/repositories/attendance.repository';
import { checkInEligibility, toDto } from '../../attendance/services/attendance.service';
import { dateInTimezone } from '../../attendance/utils/timezone.util';
import { AuditLogRepository } from '../../authentication/repositories/audit-log.repository';
import { MemberRepository, type MemberRow } from '../../members/repositories/member.repository';
import { notifyAttendanceCheckIn, notifyAttendanceCheckOut } from '../../tenant-notifications/services/notification-trigger.service';
import type { DevicePunchInput } from '../dto/attendance-device.dto';
import type { AttendanceDeviceRow } from '../repositories/attendance-device.repository';

/**
 * Turns a normalized punch (device-enrolled User ID + timestamp) from
 * `POST /attendance-devices/punches` into an ordinary `Attendance` row,
 * toggling check-in/check-out exactly like `/attendance/manual-check-in`
 * and `/attendance/manual-check-out` do — minus the staff `actor` those
 * routes require, since a device authenticates with its own API key, not a
 * user JWT (`attendanceDeviceAuth`, not `auth`). `checkedInBy`/`checkedOutBy`
 * stay null, the same nullable shape self-service QR check-ins already use.
 */
export class DevicePunchService {
  private readonly db: TenantScopedPrisma;
  private readonly attendance: AttendanceRepository;
  private readonly members: MemberRepository;
  private readonly auditLog: AuditLogRepository;

  constructor(private readonly tenantId: string) {
    this.db = getTenantScopedClient(tenantId);
    this.attendance = new AttendanceRepository(this.db);
    this.members = new MemberRepository(this.db);
    this.auditLog = new AuditLogRepository(this.db);
  }

  async recordPunch(device: AttendanceDeviceRow, input: DevicePunchInput): Promise<AttendanceRecordDto> {
    const member = await this.members.findByBiometricId(this.tenantId, input.deviceUserId);
    if (!member) {
      throw new NotFoundError(`No member is enrolled with device user ID "${input.deviceUserId}" on this device.`);
    }

    const open = await this.attendance.findOpenByMember(this.tenantId, member.id);
    const direction = input.direction ?? (open ? 'OUT' : 'IN');
    const punchTime = input.timestamp ? new Date(input.timestamp) : new Date();

    return direction === 'IN' ? this.recordCheckIn(device, member, open, punchTime) : this.recordCheckOut(device, open, punchTime);
  }

  private async recordCheckIn(device: AttendanceDeviceRow, member: MemberRow, open: AttendanceRow | null, punchTime: Date): Promise<AttendanceRecordDto> {
    if (open) throw new ConflictError(ErrorCode.CONFLICT, 'Member is already checked in.');

    if (device.branchId !== member.branchId) {
      // Same multi-branch rule `performCheckIn` enforces for staff-driven
      // check-ins — a device only waives the staff actor, not this plan rule.
      const activeMembership = member.memberships.find((m) => m.status === 'ACTIVE');
      const plan = activeMembership?.plan;
      const accessBranchIds = Array.isArray(plan?.accessBranchIds) ? (plan!.accessBranchIds as string[]) : [];
      const planAllowsBranch = !!plan && (plan.gymAccessAllBranches || accessBranchIds.includes(device.branchId));
      if (!planAllowsBranch) {
        throw new ConflictError(ErrorCode.CONFLICT, "This member's plan does not allow check-in at this branch.");
      }
    }

    const { canCheckIn, reason } = checkInEligibility(member);
    if (!canCheckIn) throw new ConflictError(ErrorCode.CONFLICT, reason ?? 'Member is not eligible to check in.');

    const timezone = await this.branchTimezone(device.branchId);
    const attendanceDate = dateInTimezone(timezone, punchTime);

    const record = await this.attendance.create({
      tenantId: this.tenantId,
      memberId: member.id,
      branchId: device.branchId,
      checkInTime: punchTime,
      attendanceDate: new Date(attendanceDate),
      method: 'BIOMETRIC',
      deviceName: device.name,
      deviceId: device.id,
      status: 'CHECKED_IN',
      checkedInBy: null,
    });

    await this.auditLog.record({
      tenantId: this.tenantId,
      actorUserId: null,
      actorRole: 'device',
      action: 'attendance.device_check_in',
      entityType: 'Attendance',
      entityId: record.id,
    });

    const dto = toDto(record);
    emitToTenant(this.tenantId, 'attendance:checkin', dto);
    await notifyAttendanceCheckIn(this.tenantId, { memberId: dto.member.id, memberName: dto.member.name, time: dto.checkInTime });
    return dto;
  }

  private async recordCheckOut(device: AttendanceDeviceRow, open: AttendanceRow | null, punchTime: Date): Promise<AttendanceRecordDto> {
    if (!open) throw new ConflictError(ErrorCode.CONFLICT, 'No active check-in found for this member.');

    await this.attendance.update(open.id, {
      checkOutTime: punchTime,
      status: 'CHECKED_OUT',
      deviceName: device.name,
      deviceId: device.id,
      checkedOutBy: null,
    });

    await this.auditLog.record({
      tenantId: this.tenantId,
      actorUserId: null,
      actorRole: 'device',
      action: 'attendance.device_check_out',
      entityType: 'Attendance',
      entityId: open.id,
    });

    const dto = toDto((await this.attendance.findById(this.tenantId, open.id, { includeDeleted: true }))!);
    emitToTenant(this.tenantId, 'attendance:checkout', dto);
    await notifyAttendanceCheckOut(this.tenantId, { memberId: dto.member.id, memberName: dto.member.name, time: dto.checkOutTime ?? punchTime.toISOString() });
    return dto;
  }

  private async branchTimezone(branchId: string): Promise<string> {
    const branch = await this.db.branch.findFirst({ where: { tenantId: this.tenantId, id: branchId }, select: { timezone: true } });
    return branch?.timezone ?? 'UTC';
  }
}
