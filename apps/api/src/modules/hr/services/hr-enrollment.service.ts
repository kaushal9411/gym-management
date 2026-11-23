import { ConflictError, NotFoundError } from '../../../core/errors/app-error';
import { ErrorCode } from '../../../core/errors/error-codes';
import { businessDate } from '../../../core/utils/business-time';
import { getTenantScopedClient, type TenantScopedPrisma } from '../../../infrastructure/database/tenant-scoped-client';
import type { IamActor } from '../../authentication/utils/actor.util';
import { StaffProfileRepository } from '../../staff/repositories/staff-profile.repository';
import { toDateCol } from '../utils/hr-dates.util';

import { HrAudit } from './hr-audit.service';
import { HrConfigService } from './hr-config.service';
import { HrSelfService } from './hr-self.service';

/** "Kaushal Chauhan" -> first "Kaushal", last "Chauhan"; a single word has an empty last name. */
export function splitName(name: string): { firstName: string; lastName: string } {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const firstName = (parts.shift() ?? 'Staff').slice(0, 80);
  return { firstName, lastName: parts.join(' ').slice(0, 80) };
}

/**
 * Opt-in self-enrolment ("Add me as an employee"): creates the caller's OWN
 * StaffProfile — in practice for the OWNER, who is created without one and so
 * gets 403 NOT_AN_EMPLOYEE on every `/hr/me/*` route. Nothing is backfilled:
 * only a deliberate call creates a profile. No pay is set (salaryAmount null),
 * so payroll skips them until a salary is configured.
 */
export class HrEnrollmentService {
  private readonly db: TenantScopedPrisma;
  private readonly profiles: StaffProfileRepository;
  private readonly config: HrConfigService;
  private readonly audit: HrAudit;

  constructor(private readonly tenantId: string) {
    this.db = getTenantScopedClient(tenantId);
    this.profiles = new StaffProfileRepository(this.db);
    this.config = new HrConfigService(tenantId);
    this.audit = new HrAudit(tenantId, this.db);
  }

  async enroll(userId: string, input: { shiftId?: string }, actor: IamActor) {
    const already = (): ConflictError => new ConflictError(ErrorCode.ALREADY_EMPLOYEE, 'You already have an employee profile.');
    if (await this.profiles.findByUserId(userId)) throw already();
    const user = await this.db.user.findFirst({ where: { id: userId, tenantId: this.tenantId, deletedAt: null } });
    if (!user) throw new NotFoundError('User not found.');

    await this.config.ensureDefaults();
    const shift = input.shiftId ? await this.config.mustFindShift(input.shiftId) : await this.config.repo.findDefaultShift(this.tenantId);
    if (shift && !shift.isActive) throw new ConflictError(ErrorCode.INVALID_STATE, 'This shift is not active.');

    const { firstName, lastName } = splitName(user.name);
    let created = false;
    let employeeId = '';
    for (let attempt = 0; attempt < 5 && !created; attempt += 1) {
      employeeId = await this.profiles.nextEmployeeId(this.tenantId);
      try {
        await this.profiles.create({
          tenantId: this.tenantId,
          userId,
          employeeId,
          firstName,
          lastName,
          joiningDate: toDateCol(businessDate()),
          employmentType: 'FULL_TIME',
          salaryType: 'MONTHLY',
          salaryAmount: null,
          shift: shift?.name ?? null,
          shiftId: shift?.id ?? null,
          weeklyOff: null, // inherits the shift / policy weekly off
          workStatus: 'WORKING',
        });
        created = true;
      } catch (error) {
        // unique(userId): a concurrent enrol won -> 409; unique(tenantId, employeeId): another profile took the number -> retry
        if (await this.profiles.findByUserId(userId)) throw already();
        if (attempt === 4) throw error;
      }
    }
    await this.audit.record(actor, 'hr.employee_enrolled', 'hr_employee', userId, { employeeId, shift: shift?.name ?? null, selfEnrolled: true });
    return new HrSelfService(this.tenantId).summary(userId);
  }
}
