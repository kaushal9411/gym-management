import type { AttendanceMethod } from '@prisma/client';
import ExcelJS from 'exceljs';

import { ConflictError, ForbiddenError, NotFoundError } from '../../../core/errors/app-error';
import { ErrorCode } from '../../../core/errors/error-codes';
import { getTenantScopedClient, type TenantScopedPrisma } from '../../../infrastructure/database/tenant-scoped-client';
import { emitToTenant } from '../../../infrastructure/realtime/socket-server';
import { getBranchAccess } from '../../authentication/middlewares/branch-access.middleware';
import { AuditLogRepository } from '../../authentication/repositories/audit-log.repository';
import type { IamActor } from '../../authentication/utils/actor.util';
import { MemberRepository, type MemberRow } from '../../members/repositories/member.repository';
import type {
  AttendanceRecordDto,
  AttendanceSummaryDto,
  CheckInInput,
  CheckOutInput,
  ListAttendanceQuery,
  QrValidationResultDto,
  UpdateAttendanceInput,
  ValidateQrCodeInput,
} from '../dto/attendance.dto';
import { AttendanceRepository, type AttendanceRow } from '../repositories/attendance.repository';
import { dateInTimezone, hourInTimezone } from '../utils/timezone.util';

function toDto(row: AttendanceRow): AttendanceRecordDto {
  return {
    id: row.id,
    member: {
      id: row.member.id,
      memberId: row.member.memberId,
      name: `${row.member.firstName} ${row.member.lastName}`.trim(),
      profilePhotoUrl: row.member.profilePhotoUrl,
    },
    branch: { id: row.branch.id, name: row.branch.name },
    checkInTime: row.checkInTime.toISOString(),
    checkOutTime: row.checkOutTime?.toISOString() ?? null,
    attendanceDate: row.attendanceDate.toISOString().slice(0, 10),
    method: row.method,
    deviceName: row.deviceName,
    deviceId: row.deviceId,
    status: row.status,
    notes: row.notes,
    checkedInBy: row.checkedInByUser ? { id: row.checkedInByUser.id, name: row.checkedInByUser.name } : null,
    checkedOutBy: row.checkedOutByUser ? { id: row.checkedOutByUser.id, name: row.checkedOutByUser.name } : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: row.deletedAt?.toISOString() ?? null,
  };
}

/** Add `days` (may be negative) to a YYYY-MM-DD string, UTC-safe. */
function addDaysStr(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Zero-fills days in [fromStr, toStr] that have no attendance rows, so the trend chart doesn't show gaps as missing data points. */
function fillTrendGaps(fromStr: string, toStr: string, rows: Array<{ date: string; count: number }>): Array<{ date: string; count: number }> {
  const byDate = new Map(rows.map((r) => [r.date, r.count]));
  const out: Array<{ date: string; count: number }> = [];
  for (let d = fromStr; d <= toStr; d = addDaysStr(d, 1)) {
    out.push({ date: d, count: byDate.get(d) ?? 0 });
  }
  return out;
}

function computePeakHour(times: Date[], timezone: string): number | null {
  if (times.length === 0) return null;
  const counts = new Map<number, number>();
  for (const t of times) {
    const hour = hourInTimezone(timezone, t);
    counts.set(hour, (counts.get(hour) ?? 0) + 1);
  }
  let bestHour = 0;
  let bestCount = -1;
  for (const [hour, count] of counts) {
    if (count > bestCount) {
      bestHour = hour;
      bestCount = count;
    }
  }
  return bestHour;
}

export class AttendanceService {
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

  private async loadMemberOrThrow(memberId: string): Promise<MemberRow> {
    const member = await this.members.findDetail(this.tenantId, memberId);
    if (!member) throw new NotFoundError('Member not found');
    return member;
  }

  private eligibility(member: MemberRow): { canCheckIn: boolean; reason: string | null } {
    if (member.status === 'FROZEN') return { canCheckIn: false, reason: 'Member is frozen and cannot check in.' };
    if (member.status !== 'ACTIVE') return { canCheckIn: false, reason: 'Member is not active.' };
    const activeMembership = member.memberships.find((m) => m.status === 'ACTIVE');
    if (!activeMembership) return { canCheckIn: false, reason: 'Member has no active membership.' };
    if (new Date(activeMembership.endDate) < new Date()) return { canCheckIn: false, reason: 'Membership has expired.' };
    return { canCheckIn: true, reason: null };
  }

  private async assertBranchAccess(actorUserId: string, branchId: string): Promise<void> {
    const access = await getBranchAccess(this.tenantId, actorUserId);
    if (!access.allBranches && !access.branchIds.includes(branchId)) {
      throw new ForbiddenError('You do not have access to record attendance at this branch.');
    }
  }

  private async branchTimezone(branchId: string): Promise<string> {
    const branch = await this.db.branch.findFirst({ where: { tenantId: this.tenantId, id: branchId }, select: { timezone: true } });
    if (!branch) throw new NotFoundError('Branch not found');
    return branch.timezone;
  }

  async validateQrCode(input: ValidateQrCodeInput): Promise<QrValidationResultDto> {
    const member = await this.members.findByQrToken(this.tenantId, input.qrCodeToken);
    if (!member) return { valid: false, reason: 'QR code not recognized.', member: null, alreadyCheckedIn: false };

    const { canCheckIn, reason } = this.eligibility(member);
    const open = await this.attendance.findOpenByMember(this.tenantId, member.id);
    return {
      valid: canCheckIn && !open,
      reason: open ? 'Member is already checked in.' : reason,
      member: {
        id: member.id,
        memberId: member.memberId,
        name: `${member.firstName} ${member.lastName}`.trim(),
        profilePhotoUrl: member.profilePhotoUrl,
        branchId: member.branchId,
        status: member.status,
      },
      alreadyCheckedIn: !!open,
    };
  }

  private async performCheckIn(
    input: CheckInInput,
    actor: IamActor,
    opts: { method: AttendanceMethod; manual: boolean },
  ): Promise<AttendanceRecordDto> {
    const member = await this.loadMemberOrThrow(input.memberId);

    const branchId = input.branchId ?? member.branchId;
    if (branchId !== member.branchId) {
      throw new ConflictError(ErrorCode.CONFLICT, 'This member is not assigned to this branch.');
    }
    await this.assertBranchAccess(actor.userId, branchId);

    const { canCheckIn, reason } = this.eligibility(member);
    if (!canCheckIn) throw new ConflictError(ErrorCode.CONFLICT, reason ?? 'Member is not eligible to check in.');

    const existing = await this.attendance.findOpenByMember(this.tenantId, member.id);
    if (existing) throw new ConflictError(ErrorCode.CONFLICT, 'Member is already checked in.');

    const timezone = await this.branchTimezone(branchId);
    const now = new Date();
    const attendanceDate = dateInTimezone(timezone, now);

    const record = await this.attendance.create({
      tenantId: this.tenantId,
      memberId: member.id,
      branchId,
      checkInTime: now,
      attendanceDate: new Date(attendanceDate),
      method: opts.method,
      deviceName: input.deviceName,
      deviceId: input.deviceId,
      notes: input.notes,
      status: 'CHECKED_IN',
      checkedInBy: opts.manual ? actor.userId : null,
    });

    await this.auditLog.record({
      tenantId: this.tenantId,
      actorUserId: actor.userId,
      actorRole: actor.role,
      action: opts.manual ? 'attendance.manual_check_in' : 'attendance.check_in',
      entityType: 'Attendance',
      entityId: record.id,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });

    const dto = toDto(record);
    emitToTenant(this.tenantId, 'attendance:checkin', dto);
    return dto;
  }

  async checkIn(input: CheckInInput, actor: IamActor): Promise<AttendanceRecordDto> {
    return this.performCheckIn(input, actor, { method: input.method ?? 'QR_CODE', manual: false });
  }

  async manualCheckIn(input: CheckInInput, actor: IamActor): Promise<AttendanceRecordDto> {
    return this.performCheckIn(input, actor, { method: 'MANUAL', manual: true });
  }

  private async performCheckOut(input: CheckOutInput, actor: IamActor, manual: boolean): Promise<AttendanceRecordDto> {
    const record = input.attendanceId
      ? await this.attendance.findById(this.tenantId, input.attendanceId)
      : input.memberId
        ? await this.attendance.findOpenByMember(this.tenantId, input.memberId)
        : null;

    if (!record || record.checkOutTime) {
      throw new ConflictError(ErrorCode.CONFLICT, 'No active check-in found for this member.');
    }
    await this.assertBranchAccess(actor.userId, record.branchId);

    await this.attendance.update(record.id, {
      checkOutTime: new Date(),
      status: 'CHECKED_OUT',
      notes: input.notes ?? record.notes,
      deviceName: input.deviceName ?? record.deviceName,
      deviceId: input.deviceId ?? record.deviceId,
      checkedOutBy: manual ? actor.userId : record.checkedOutBy,
    });

    await this.auditLog.record({
      tenantId: this.tenantId,
      actorUserId: actor.userId,
      actorRole: actor.role,
      action: manual ? 'attendance.manual_check_out' : 'attendance.check_out',
      entityType: 'Attendance',
      entityId: record.id,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });

    const dto = toDto((await this.attendance.findById(this.tenantId, record.id, { includeDeleted: true }))!);
    emitToTenant(this.tenantId, 'attendance:checkout', dto);
    return dto;
  }

  async checkOut(input: CheckOutInput, actor: IamActor): Promise<AttendanceRecordDto> {
    return this.performCheckOut(input, actor, false);
  }

  async manualCheckOut(input: CheckOutInput, actor: IamActor): Promise<AttendanceRecordDto> {
    return this.performCheckOut(input, actor, true);
  }

  async list(query: ListAttendanceQuery): Promise<{ items: AttendanceRecordDto[]; total: number; page: number; limit: number; totalPages: number }> {
    const { items, total } = await this.attendance.list(this.tenantId, query);
    return { items: items.map(toDto), total, page: query.page, limit: query.limit, totalPages: Math.max(1, Math.ceil(total / query.limit)) };
  }

  async getToday(branchId?: string): Promise<AttendanceRecordDto[]> {
    const timezone = branchId ? await this.branchTimezone(branchId) : 'UTC';
    const todayStr = dateInTimezone(timezone);
    const { items } = await this.attendance.list(this.tenantId, {
      page: 1,
      limit: 500,
      branchId,
      dateFrom: todayStr,
      dateTo: todayStr,
      includeDeleted: false,
      sortBy: 'checkInTime',
      sortDir: 'desc',
    });
    return items.map(toDto);
  }

  async getById(id: string): Promise<AttendanceRecordDto> {
    const record = await this.attendance.findById(this.tenantId, id, { includeDeleted: true });
    if (!record) throw new NotFoundError('Attendance record not found');
    return toDto(record);
  }

  async getMemberAttendance(
    memberId: string,
    pagination: { page: number; limit: number },
  ): Promise<{ items: AttendanceRecordDto[]; total: number; page: number; limit: number; totalPages: number }> {
    const { items, total } = await this.attendance.findByMember(this.tenantId, memberId, pagination);
    return { items: items.map(toDto), total, page: pagination.page, limit: pagination.limit, totalPages: Math.max(1, Math.ceil(total / pagination.limit)) };
  }

  async getBranchAttendance(branchId: string, query: ListAttendanceQuery): Promise<{ items: AttendanceRecordDto[]; total: number; page: number; limit: number; totalPages: number }> {
    return this.list({ ...query, branchId });
  }

  async getSummary(params: { branchId?: string; dateFrom?: string; dateTo?: string }): Promise<AttendanceSummaryDto> {
    const timezone = params.branchId ? await this.branchTimezone(params.branchId) : 'UTC';
    const todayStr = dateInTimezone(timezone);

    const [{ checkIns, checkOuts, currentlyInside }, checkInTimes] = await Promise.all([
      this.attendance.countForDate(this.tenantId, todayStr, params.branchId),
      this.attendance.listCheckInTimesForDate(this.tenantId, todayStr, params.branchId),
    ]);

    const toStr = params.dateTo ?? todayStr;
    const fromStr = params.dateFrom ?? addDaysStr(toStr, -6);
    const trendRows = await this.attendance.trendBetween(this.tenantId, fromStr, toStr, params.branchId);

    return {
      totalCheckInsToday: checkIns,
      totalCheckOutsToday: checkOuts,
      currentlyInside,
      peakCheckInHour: computePeakHour(checkInTimes, timezone),
      trend: fillTrendGaps(fromStr, toStr, trendRows),
    };
  }

  async update(id: string, input: UpdateAttendanceInput, actor: IamActor): Promise<AttendanceRecordDto> {
    const record = await this.attendance.findById(this.tenantId, id, { includeDeleted: true });
    if (!record) throw new NotFoundError('Attendance record not found');

    const checkInTime = input.checkInTime ? new Date(input.checkInTime) : undefined;
    const attendanceDate = checkInTime ? new Date(dateInTimezone(record.branch.timezone, checkInTime)) : undefined;

    const checkOutTime = input.checkOutTime === undefined ? undefined : input.checkOutTime === null ? null : new Date(input.checkOutTime);

    await this.attendance.update(id, {
      checkInTime,
      attendanceDate,
      checkOutTime,
      notes: input.notes,
      status: input.status,
    });

    await this.auditLog.record({
      tenantId: this.tenantId,
      actorUserId: actor.userId,
      actorRole: actor.role,
      action: 'attendance.update',
      entityType: 'Attendance',
      entityId: id,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });

    return this.getById(id);
  }

  async softDelete(id: string, actor: IamActor): Promise<void> {
    const record = await this.attendance.findById(this.tenantId, id);
    if (!record) throw new NotFoundError('Attendance record not found');

    await this.attendance.softDelete(id);
    await this.auditLog.record({
      tenantId: this.tenantId,
      actorUserId: actor.userId,
      actorRole: actor.role,
      action: 'attendance.delete',
      entityType: 'Attendance',
      entityId: id,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });
  }

  async exportCsv(query: Partial<ListAttendanceQuery>): Promise<string> {
    const rows = await this.attendance.listForExport(this.tenantId, query);
    const header = 'Member ID,Member Name,Branch,Check In,Check Out,Date,Method,Status,Device Name,Device ID,Notes';
    const escape = (value: string) => (/[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);
    const lines = rows.map((r) => {
      const dto = toDto(r);
      return [
        dto.member.memberId,
        escape(dto.member.name),
        escape(dto.branch.name),
        dto.checkInTime,
        dto.checkOutTime ?? '',
        dto.attendanceDate,
        dto.method,
        dto.status,
        dto.deviceName ? escape(dto.deviceName) : '',
        dto.deviceId ?? '',
        dto.notes ? escape(dto.notes) : '',
      ].join(',');
    });
    return [header, ...lines].join('\n');
  }

  async exportExcel(query: Partial<ListAttendanceQuery>): Promise<ExcelJS.Buffer> {
    const rows = await this.attendance.listForExport(this.tenantId, query);
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Attendance');
    sheet.columns = [
      { header: 'Member ID', key: 'memberId', width: 14 },
      { header: 'Member Name', key: 'memberName', width: 24 },
      { header: 'Branch', key: 'branch', width: 20 },
      { header: 'Check In', key: 'checkIn', width: 22 },
      { header: 'Check Out', key: 'checkOut', width: 22 },
      { header: 'Date', key: 'date', width: 14 },
      { header: 'Method', key: 'method', width: 14 },
      { header: 'Status', key: 'status', width: 14 },
      { header: 'Device Name', key: 'deviceName', width: 18 },
      { header: 'Device ID', key: 'deviceId', width: 18 },
      { header: 'Notes', key: 'notes', width: 30 },
    ];
    sheet.getRow(1).font = { bold: true };
    for (const r of rows) {
      const dto = toDto(r);
      sheet.addRow({
        memberId: dto.member.memberId,
        memberName: dto.member.name,
        branch: dto.branch.name,
        checkIn: dto.checkInTime,
        checkOut: dto.checkOutTime ?? '',
        date: dto.attendanceDate,
        method: dto.method,
        status: dto.status,
        deviceName: dto.deviceName ?? '',
        deviceId: dto.deviceId ?? '',
        notes: dto.notes ?? '',
      });
    }
    return workbook.xlsx.writeBuffer();
  }
}
