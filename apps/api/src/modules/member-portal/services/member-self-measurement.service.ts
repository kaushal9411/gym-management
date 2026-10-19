import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../../../core/errors/app-error';
import { ErrorCode } from '../../../core/errors/error-codes';
import { getTenantScopedClient, type TenantScopedPrisma } from '../../../infrastructure/database/tenant-scoped-client';
import { dateInTimezone } from '../../attendance/utils/timezone.util';
import { AuditLogRepository } from '../../authentication/repositories/audit-log.repository';
import type { BodyMeasurementDto } from '../../measurements/dto/measurement.dto';
import { MeasurementRepository, type MeasurementRow } from '../../measurements/repositories/measurement.repository';
import { toMeasurementDto } from '../../measurements/services/measurement.service';
import {
  dayOfRecordedAt,
  hasMeasurementValue,
  pickMeasurementValues,
  resolveMemberMeasurementDay,
  type MemberMeasurementValues,
} from '../utils/member-measurement.util';

export interface MeasurementRequestContext {
  ipAddress?: string;
  userAgent?: string;
}

export type MemberMeasurementInput = MemberMeasurementValues & { recordedAt?: string };

const isUniqueViolation = (error: unknown): boolean => (error as { code?: string } | null)?.code === 'P2002';

/**
 * Member self-tracking of body measurements (`/portal/measurements` writes).
 *
 * Every method takes the member's OWN id from the token — no route carries a
 * member id. Rules: a member only ever touches rows with `memberId = self`
 * AND `source = MEMBER` (staff-recorded entries are read-only: 403), at most
 * one MEMBER entry per day (create upserts/merges), no future dates, at most
 * 365 days of back-dating. "Today" is the member's branch-local date.
 * `recordedBy` stays null for these rows.
 */
export class MemberSelfMeasurementService {
  private readonly db: TenantScopedPrisma;
  private readonly measurements: MeasurementRepository;
  private readonly auditLog: AuditLogRepository;

  constructor(private readonly tenantId: string) {
    this.db = getTenantScopedClient(tenantId);
    this.measurements = new MeasurementRepository(this.db);
    this.auditLog = new AuditLogRepository(this.db);
  }

  /** Create today's (or the chosen day's) entry — or merge into the existing MEMBER entry for that day. */
  async log(
    memberId: string,
    input: MemberMeasurementInput,
    ctx: MeasurementRequestContext,
  ): Promise<{ measurement: BodyMeasurementDto; created: boolean }> {
    if (!hasMeasurementValue(input)) throw new ValidationError('Enter at least one measurement.');
    const { day, date } = resolveMemberMeasurementDay(input.recordedAt, await this.today(memberId));
    const values = pickMeasurementValues(input);

    const existing = await this.measurements.findMemberEntryOnDay(this.tenantId, memberId, date);
    if (existing) return { measurement: await this.merge(memberId, existing, values, day, ctx), created: false };

    try {
      const row = await this.measurements.create({
        tenantId: this.tenantId,
        memberId,
        recordedAt: date,
        ...values,
        notes: values.notes || undefined,
        source: 'MEMBER',
        recordedBy: null,
      });
      await this.audit('member_portal.measurement_logged', row.id, memberId, ctx, { day, fields: Object.keys(values) });
      return { measurement: toMeasurementDto(row), created: true };
    } catch (error) {
      // Lost a same-day race against the partial unique index -> merge instead.
      if (!isUniqueViolation(error)) throw error;
      const raced = await this.measurements.findMemberEntryOnDay(this.tenantId, memberId, date);
      if (!raced) throw error;
      return { measurement: await this.merge(memberId, raced, values, day, ctx), created: false };
    }
  }

  async update(
    memberId: string,
    id: string,
    input: MemberMeasurementInput,
    ctx: MeasurementRequestContext,
  ): Promise<BodyMeasurementDto> {
    const existing = await this.mustOwn(memberId, id);
    const values = pickMeasurementValues(input);
    if (Object.keys(values).length === 0 && input.recordedAt === undefined) {
      throw new ValidationError('Nothing to update.');
    }

    let moveTo: { day: string; date: Date } | undefined;
    // The client re-sends the entry's own date on every edit - only a real move is validated.
    if (input.recordedAt !== undefined && dayOfRecordedAt(input.recordedAt) !== existing.recordedAt.toISOString().slice(0, 10)) {
      const resolved = resolveMemberMeasurementDay(input.recordedAt, await this.today(memberId));
      const clash = await this.measurements.findMemberEntryOnDay(this.tenantId, memberId, resolved.date);
      if (clash) throw new ConflictError(ErrorCode.CONFLICT, 'You already have an entry for that day. Edit it instead.');
      moveTo = resolved;
    }

    try {
      const row = await this.measurements.update(id, {
        ...(moveTo ? { recordedAt: moveTo.date } : {}),
        ...this.writable(values),
      });
      await this.audit('member_portal.measurement_updated', id, memberId, ctx, {
        day: row.recordedAt.toISOString().slice(0, 10),
        fields: [...Object.keys(values), ...(moveTo ? ['recordedAt'] : [])],
      });
      return toMeasurementDto(row);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictError(ErrorCode.CONFLICT, 'You already have an entry for that day. Edit it instead.');
      }
      throw error;
    }
  }

  async delete(memberId: string, id: string, ctx: MeasurementRequestContext): Promise<void> {
    const existing = await this.mustOwn(memberId, id);
    await this.measurements.delete(id);
    await this.audit('member_portal.measurement_deleted', id, memberId, ctx, {
      day: existing.recordedAt.toISOString().slice(0, 10),
    });
  }

  /** Row must exist, belong to this member (404 otherwise — never reveal other members' ids) and be member-logged (403 for staff entries). */
  private async mustOwn(memberId: string, id: string): Promise<MeasurementRow> {
    const row = await this.measurements.findById(this.tenantId, id);
    if (!row || row.memberId !== memberId) throw new NotFoundError('Measurement entry not found.');
    if (row.source !== 'MEMBER') {
      throw new ForbiddenError('This entry was recorded by your gym staff, so you can’t change or delete it.');
    }
    return row;
  }

  private async merge(
    memberId: string,
    existing: MeasurementRow,
    values: MemberMeasurementValues,
    day: string,
    ctx: MeasurementRequestContext,
  ): Promise<BodyMeasurementDto> {
    const row = await this.measurements.update(existing.id, this.writable(values));
    await this.audit('member_portal.measurement_updated', existing.id, memberId, ctx, { day, fields: Object.keys(values) });
    return toMeasurementDto(row);
  }

  /** Update payload: only supplied fields; a blank note clears it. */
  private writable(values: MemberMeasurementValues) {
    const { notes, ...numbers } = values;
    return { ...numbers, ...(notes !== undefined ? { notes: notes === '' ? null : notes } : {}) };
  }

  /** The member's branch-local calendar date ("today" for the future / back-date checks). */
  private async today(memberId: string): Promise<string> {
    const member = await this.db.member.findFirst({
      where: { tenantId: this.tenantId, id: memberId, deletedAt: null },
      select: { branch: { select: { timezone: true } } },
    });
    if (!member) throw new NotFoundError('Member not found.');
    return dateInTimezone(member.branch.timezone || 'UTC');
  }

  private async audit(
    action: string,
    entityId: string,
    memberId: string,
    ctx: MeasurementRequestContext,
    after: Record<string, unknown>,
  ): Promise<void> {
    await this.auditLog.record({
      tenantId: this.tenantId,
      actorUserId: null,
      actorRole: 'MEMBER',
      action,
      entityType: 'body_measurement',
      entityId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      // Field NAMES + day only; no body values.
      after: { memberId, ...after },
    });
  }
}
