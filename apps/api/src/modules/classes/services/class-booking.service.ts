import { AppError, ConflictError, ForbiddenError, NotFoundError } from '../../../core/errors/app-error';
import { ErrorCode } from '../../../core/errors/error-codes';
import { getTenantScopedClient, type TenantScopedPrisma } from '../../../infrastructure/database/tenant-scoped-client';
import { getBranchAccess } from '../../authentication/middlewares/branch-access.middleware';
import { AuditLogRepository } from '../../authentication/repositories/audit-log.repository';
import type { ClassBookingDto } from '../dto/classes.dto';
import { ClassBookingRepository, type ClassBookingRow } from '../repositories/class-booking.repository';
import { ClassSessionRepository } from '../repositories/class-session.repository';

export interface BookingActor {
  role: 'STAFF' | 'MEMBER';
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
}

function toDto(row: ClassBookingRow, memberName: string, memberCode: string): ClassBookingDto {
  return {
    id: row.id,
    member: { id: row.memberId, memberId: memberCode, name: memberName },
    status: row.status,
    bookedByRole: row.bookedByRole,
    bookedAt: row.bookedAt.toISOString(),
    cancelledAt: row.cancelledAt?.toISOString() ?? null,
  };
}

export class ClassBookingService {
  private readonly db: TenantScopedPrisma;
  private readonly sessions: ClassSessionRepository;
  private readonly bookings: ClassBookingRepository;
  private readonly auditLog: AuditLogRepository;

  constructor(private readonly tenantId: string) {
    this.db = getTenantScopedClient(tenantId);
    this.sessions = new ClassSessionRepository(this.db);
    this.bookings = new ClassBookingRepository(this.db);
    this.auditLog = new AuditLogRepository(this.db);
  }

  /**
   * Eligibility mirrors `AttendanceService`'s own check (active,
   * non-frozen membership) — a class session is another form of gym
   * attendance, same business rule. Capacity is a count-then-insert check,
   * not a locked/serialized transaction: under a true race on the very last
   * seat, two concurrent bookings could both pass the check and both
   * insert, a small accepted overbook risk for a low-frequency write path
   * (documented on the schema's `ClassBooking` model too).
   */
  async book(sessionId: string, memberId: string, booker: BookingActor): Promise<ClassBookingDto> {
    if (booker.role === 'STAFF' && booker.userId) await this.assertBranchAccessForSession(booker.userId, sessionId);

    const session = await this.db.classSession.findFirst({ where: { tenantId: this.tenantId, id: sessionId } });
    if (!session) throw new NotFoundError('Class session not found.');
    if (session.status !== 'SCHEDULED') throw new ConflictError(ErrorCode.CONFLICT, 'This session is no longer scheduled.');
    const sessionEndsAt = new Date(`${session.sessionDate.toISOString().slice(0, 10)}T${session.endTime}:00.000Z`);
    if (sessionEndsAt < new Date()) throw new ConflictError(ErrorCode.CONFLICT, 'This session has already ended.');

    const member = await this.db.member.findFirst({
      where: { tenantId: this.tenantId, id: memberId, deletedAt: null },
      include: { memberships: { where: { status: 'ACTIVE' } } },
    });
    if (!member) throw new NotFoundError('Member not found.');
    if (member.status === 'FROZEN') throw new ConflictError(ErrorCode.CONFLICT, 'This member is frozen and cannot book classes.');
    if (member.status !== 'ACTIVE') throw new ConflictError(ErrorCode.CONFLICT, 'This member is not active.');
    const activeMembership = member.memberships[0];
    if (!activeMembership || new Date(activeMembership.endDate) < new Date()) {
      throw new ConflictError(ErrorCode.CONFLICT, 'This member has no active membership.');
    }

    const existingBooking = await this.bookings.findActiveByMemberAndSession(this.tenantId, sessionId, memberId);
    if (existingBooking) throw new ConflictError(ErrorCode.CONFLICT, 'This member is already booked into this session.');

    const bookedCount = await this.bookings.countActive(this.tenantId, sessionId);
    if (bookedCount >= session.capacity) throw new AppError(ErrorCode.CONFLICT, 'This session is fully booked.', 409);

    const booking = await this.bookings.upsertBooking({
      tenantId: this.tenantId,
      classSessionId: sessionId,
      memberId,
      status: 'BOOKED',
      bookedByRole: booker.role,
      bookedByUserId: booker.userId,
    });
    await this.auditLog.record({
      tenantId: this.tenantId,
      actorUserId: booker.role === 'STAFF' ? (booker.userId ?? null) : null,
      actorRole: booker.role,
      action: 'class_booking.booked',
      entityType: 'class_booking',
      entityId: booking.id,
      ipAddress: booker.ipAddress,
      userAgent: booker.userAgent,
    });
    return toDto(booking, `${member.firstName} ${member.lastName}`.trim(), member.memberId);
  }

  async cancel(bookingId: string, memberIdIfMember: string | undefined, booker: BookingActor): Promise<void> {
    const booking = await this.db.classBooking.findFirst({ where: { tenantId: this.tenantId, id: bookingId } });
    if (!booking) throw new NotFoundError('Booking not found.');
    // A member can only cancel their own booking; staff can cancel any.
    if (booker.role === 'MEMBER' && booking.memberId !== memberIdIfMember) throw new NotFoundError('Booking not found.');
    if (booking.status !== 'BOOKED') throw new ConflictError(ErrorCode.CONFLICT, 'This booking is not active.');

    await this.bookings.cancel(bookingId);
    await this.auditLog.record({
      tenantId: this.tenantId,
      actorUserId: booker.role === 'STAFF' ? (booker.userId ?? null) : null,
      actorRole: booker.role,
      action: 'class_booking.cancelled',
      entityType: 'class_booking',
      entityId: bookingId,
      ipAddress: booker.ipAddress,
      userAgent: booker.userAgent,
    });
  }

  async listForMember(memberId: string) {
    const rows = await this.bookings.listByMember(this.tenantId, memberId, { upcomingOnly: true });
    return rows.map((r) => ({
      id: r.id,
      status: r.status,
      bookedAt: r.bookedAt.toISOString(),
      session: {
        id: r.classSession.id,
        groupClass: { id: r.classSession.groupClass.id, name: r.classSession.groupClass.name },
        branch: { id: r.classSession.branch.id, name: r.classSession.branch.name },
        sessionDate: r.classSession.sessionDate.toISOString().slice(0, 10),
        startTime: r.classSession.startTime,
        endTime: r.classSession.endTime,
      },
    }));
  }

  private async assertBranchAccessForSession(actorUserId: string, sessionId: string): Promise<void> {
    const session = await this.db.classSession.findFirst({ where: { tenantId: this.tenantId, id: sessionId }, select: { branchId: true } });
    if (!session) return; // let the main lookup below produce the real NotFoundError
    const access = await getBranchAccess(this.tenantId, actorUserId);
    if (!access.allBranches && !access.branchIds.includes(session.branchId)) {
      throw new ForbiddenError('You do not have access to book classes at this branch.');
    }
  }
}
