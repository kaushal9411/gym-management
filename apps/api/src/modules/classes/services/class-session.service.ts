import { NotFoundError } from '../../../core/errors/app-error';
import { getTenantScopedClient, type TenantScopedPrisma } from '../../../infrastructure/database/tenant-scoped-client';
import { resolveBranchScope } from '../../reports/utils/branch-scope.util';
import type { ClassSessionDetailDto, ClassSessionDto, ListSessionsQuery } from '../dto/classes.dto';
import { ClassSessionRepository, type ClassSessionDetailRow, type ClassSessionRow } from '../repositories/class-session.repository';
import { GroupClassRepository } from '../repositories/group-class.repository';

const WEEKDAY_JS_INDEX: Record<string, number> = {
  SUNDAY: 0,
  MONDAY: 1,
  TUESDAY: 2,
  WEDNESDAY: 3,
  THURSDAY: 4,
  FRIDAY: 5,
  SATURDAY: 6,
};

/** "HH:mm" + minutes → "HH:mm", wrapping within a day (a class is never assumed to run past midnight). */
function addMinutes(startTime: string, minutes: number): string {
  const [h, m] = startTime.split(':').map(Number);
  const total = (h ?? 0) * 60 + (m ?? 0) + minutes;
  const wrapped = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
  return `${String(Math.floor(wrapped / 60)).padStart(2, '0')}:${String(wrapped % 60).padStart(2, '0')}`;
}

function toDto(row: ClassSessionRow): ClassSessionDto {
  return {
    id: row.id,
    groupClass: { id: row.groupClass.id, name: row.groupClass.name },
    branch: { id: row.branch.id, name: row.branch.name },
    trainer: row.trainer ? { id: row.trainer.id, name: row.trainer.name } : null,
    sessionDate: row.sessionDate.toISOString().slice(0, 10),
    startTime: row.startTime,
    endTime: row.endTime,
    capacity: row.capacity,
    bookedCount: row._count.bookings,
    status: row.status,
  };
}

function toDetailDto(row: ClassSessionDetailRow): ClassSessionDetailDto {
  return {
    ...toDto(row),
    bookings: row.bookings.map((b) => ({
      id: b.id,
      member: { id: b.member.id, memberId: b.member.memberId, name: `${b.member.firstName} ${b.member.lastName}`.trim() },
      status: b.status,
      bookedByRole: b.bookedByRole,
      bookedAt: b.bookedAt.toISOString(),
      cancelledAt: b.cancelledAt?.toISOString() ?? null,
    })),
  };
}

export class ClassSessionService {
  private readonly db: TenantScopedPrisma;
  private readonly classes: GroupClassRepository;
  private readonly sessions: ClassSessionRepository;

  constructor(private readonly tenantId: string) {
    this.db = getTenantScopedClient(tenantId);
    this.classes = new GroupClassRepository(this.db);
    this.sessions = new ClassSessionRepository(this.db);
  }

  async listByRange(userId: string | undefined, query: ListSessionsQuery): Promise<ClassSessionDto[]> {
    const branchScope = await resolveBranchScope(this.tenantId, userId, query.branchId);
    const dateFrom = new Date(`${query.dateFrom}T00:00:00.000Z`);
    const dateTo = new Date(`${query.dateTo}T23:59:59.999Z`);
    const rows = await this.sessions.listByRange(this.tenantId, {
      dateFrom,
      dateTo,
      groupClassId: query.groupClassId,
      ...(typeof branchScope === 'string' ? { branchId: branchScope } : {}),
    });
    // `{in: [...]}` branch-scope shape isn't a single filter the repository's simple signature takes — filter in memory for that case (a handful of branches at most, never a real bottleneck).
    const filtered = branchScope && typeof branchScope === 'object' ? rows.filter((r) => (branchScope.in as string[]).includes(r.branch.id)) : rows;
    return filtered.map(toDto);
  }

  async getById(id: string): Promise<ClassSessionDetailDto> {
    const row = await this.sessions.findById(this.tenantId, id);
    if (!row) throw new NotFoundError('Class session not found.');
    return toDetailDto(row);
  }

  /**
   * Generates concrete `ClassSession` rows from every active class's weekly
   * schedule for a rolling lookahead window — idempotent (the schema's
   * `@@unique([groupClassId, sessionDate, startTime])` makes re-running this
   * for an already-generated date a safe no-op, checked explicitly first
   * rather than relying on a caught unique-constraint error). Called both by
   * the BullMQ sweep (`jobs/class-session-generation.jobs.ts`) and an
   * on-demand "regenerate now" endpoint for immediate feedback after
   * creating/editing a class.
   */
  async generateUpcomingSessions(daysAhead = 28): Promise<{ created: number }> {
    const activeClasses = await this.classes.listActive(this.tenantId);
    let created = 0;
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    for (const groupClass of activeClasses) {
      for (let offset = 0; offset < daysAhead; offset += 1) {
        const date = new Date(today);
        date.setUTCDate(date.getUTCDate() + offset);
        const jsDay = date.getUTCDay();
        const slotsForDay = groupClass.schedule.filter((s) => WEEKDAY_JS_INDEX[s.dayOfWeek] === jsDay);

        for (const slot of slotsForDay) {
          // eslint-disable-next-line no-await-in-loop -- generation is a low-frequency background sweep, not a request-path hot loop; sequential keeps it simple and safe on the tenant-scoped client.
          const existing = await this.sessions.findExisting(this.tenantId, groupClass.id, date, slot.startTime);
          if (existing) continue;

          // eslint-disable-next-line no-await-in-loop
          await this.sessions.create({
            tenantId: this.tenantId,
            groupClassId: groupClass.id,
            branchId: groupClass.branchId,
            trainerId: groupClass.trainerId,
            sessionDate: date,
            startTime: slot.startTime,
            endTime: addMinutes(slot.startTime, groupClass.durationMinutes),
            capacity: groupClass.capacity,
            status: 'SCHEDULED',
          });
          created += 1;
        }
      }
    }
    return { created };
  }
}
