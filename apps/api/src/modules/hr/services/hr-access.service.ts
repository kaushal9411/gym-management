import { AppError, NotFoundError } from '../../../core/errors/app-error';
import { ErrorCode } from '../../../core/errors/error-codes';
import { getBranchAccess } from '../../authentication/middlewares/branch-access.middleware';
import type { EmployeeRow, HrEmployeeRepository } from '../repositories/hr-employee.repository';

/** Employee lookups + branch scoping shared by every HR service. */
export class HrAccess {
  constructor(
    private readonly tenantId: string,
    readonly employees: HrEmployeeRepository,
  ) {}

  /** Branch ids the actor is limited to, or `undefined` for "all branches". */
  async scope(actorUserId: string): Promise<string[] | undefined> {
    const access = await getBranchAccess(this.tenantId, actorUserId);
    return access.allBranches ? undefined : access.branchIds;
  }

  /** An employee the actor may act on — 404 when unknown, not an employee, or outside the actor's branches. */
  async mustFindEmployee(userId: string, actorUserId: string): Promise<EmployeeRow> {
    const emp = await this.employees.findOne(this.tenantId, userId, await this.scope(actorUserId));
    if (!emp) throw new NotFoundError('Employee not found.');
    return emp;
  }

  /** The caller's own employee record; users without a StaffProfile cannot use /hr/me. */
  async requireSelf(userId: string): Promise<EmployeeRow> {
    const emp = await this.employees.findOne(this.tenantId, userId);
    if (!emp) throw new AppError(ErrorCode.NOT_AN_EMPLOYEE, 'You do not have an employee profile, so HR self-service is not available.', 403);
    return emp;
  }
}
