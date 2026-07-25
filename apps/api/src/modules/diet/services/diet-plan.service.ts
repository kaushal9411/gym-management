import type { MealType, Prisma } from '@prisma/client';

import { ConflictError, NotFoundError, ValidationError } from '../../../core/errors/app-error';
import { ErrorCode } from '../../../core/errors/error-codes';
import { getTenantScopedClient, type TenantScopedPrisma } from '../../../infrastructure/database/tenant-scoped-client';
import { AuditLogRepository } from '../../authentication/repositories/audit-log.repository';
import type { IamActor } from '../../authentication/utils/actor.util';
import type {
  AssignDietPlanInput,
  CreateDietPlanInput,
  DailyLogDto,
  DietPlanDetailDto,
  DietPlanListItemDto,
  ListDietPlansQuery,
  MemberDietPlanDto,
  PlanMealDto,
  PlanMealInput,
  UpdateDietPlanInput,
  UpdateDietProgressInput,
  UpdateMemberDietPlanInput,
} from '../dto/diet.dto';
import { DietPlanRepository, type DietPlanDetailRow, type DietPlanListRow } from '../repositories/diet-plan.repository';
import { MemberDietPlanRepository, type MemberDietPlanRow } from '../repositories/member-diet-plan.repository';

function toListDto(row: DietPlanListRow): DietPlanListItemDto {
  return {
    id: row.id,
    name: row.name,
    goal: row.goal,
    dailyCalories: row.dailyCalories,
    durationDays: row.durationDays,
    trainer: row.trainer ? { id: row.trainer.id, name: row.trainer.name } : null,
    isActive: row.isActive,
    activeMemberCount: row._count.members,
    createdAt: row.createdAt.toISOString(),
    deletedAt: row.deletedAt?.toISOString() ?? null,
  };
}

function toPlanMealDto(row: DietPlanDetailRow['meals'][number]): PlanMealDto {
  return {
    id: row.id,
    food: {
      id: row.food.id,
      name: row.food.name,
      category: row.food.category,
      servingSize: row.food.servingSize,
      calories: row.food.calories,
      protein: row.food.protein?.toString() ?? null,
      carbohydrates: row.food.carbohydrates?.toString() ?? null,
      fat: row.food.fat?.toString() ?? null,
      fiber: row.food.fiber?.toString() ?? null,
      sugar: row.food.sugar?.toString() ?? null,
      sodium: row.food.sodium?.toString() ?? null,
      notes: row.food.notes,
      isActive: row.food.isActive,
      createdAt: row.food.createdAt.toISOString(),
      updatedAt: row.food.updatedAt.toISOString(),
      deletedAt: row.food.deletedAt?.toISOString() ?? null,
    },
    mealType: row.mealType,
    sortOrder: row.sortOrder,
    quantity: row.quantity.toString(),
    notes: row.notes,
  };
}

function toDetailDto(row: DietPlanDetailRow): DietPlanDetailDto {
  return {
    ...toListDto(row),
    description: row.description,
    notes: row.notes,
    updatedAt: row.updatedAt.toISOString(),
    meals: row.meals.map(toPlanMealDto),
  };
}

function toAssignmentDto(row: MemberDietPlanRow): MemberDietPlanDto {
  const mealTypesInPlan = [...new Set(row.dietPlan.meals.map((m) => m.mealType))];
  const totalSlots = mealTypesInPlan.length;

  const dailyLogs: DailyLogDto[] = row.dailyLogs.map((log) => ({
    date: log.date.toISOString().slice(0, 10),
    waterIntakeMl: log.waterIntakeMl,
    weightKg: log.weightKg?.toString() ?? null,
    mealsStatus: (log.mealsStatus as Record<MealType, 'PENDING' | 'COMPLETED' | 'SKIPPED'> | null) ?? {},
    notes: log.notes,
    updatedAt: log.updatedAt.toISOString(),
  }));

  let progressPercent = 0;
  if (dailyLogs.length > 0 && totalSlots > 0) {
    const perDayRates = dailyLogs.map((log) => {
      const completed = mealTypesInPlan.filter((mt) => log.mealsStatus[mt] === 'COMPLETED').length;
      return completed / totalSlots;
    });
    progressPercent = Math.round((perDayRates.reduce((a, b) => a + b, 0) / perDayRates.length) * 100);
  }

  const latest = dailyLogs[0]; // already ordered desc by date

  return {
    id: row.id,
    member: { id: row.member.id, memberId: row.member.memberId, name: `${row.member.firstName} ${row.member.lastName}`.trim() },
    dietPlan: {
      id: row.dietPlan.id,
      name: row.dietPlan.name,
      dailyCalories: row.dietPlan.dailyCalories,
      durationDays: row.dietPlan.durationDays,
      mealTypes: mealTypesInPlan,
    },
    assignedDate: row.assignedDate.toISOString().slice(0, 10),
    startDate: row.startDate.toISOString().slice(0, 10),
    endDate: row.endDate?.toISOString().slice(0, 10) ?? null,
    status: row.status,
    trainerRemarks: row.trainerRemarks,
    memberNotes: row.memberNotes,
    progressPercent,
    daysLogged: dailyLogs.length,
    latestWeightKg: latest?.weightKg ?? null,
    latestWaterIntakeMl: latest?.waterIntakeMl ?? null,
    dailyLogs,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export class DietPlanService {
  private readonly db: TenantScopedPrisma;
  private readonly plans: DietPlanRepository;
  private readonly assignments: MemberDietPlanRepository;
  private readonly auditLog: AuditLogRepository;

  constructor(private readonly tenantId: string) {
    this.db = getTenantScopedClient(tenantId);
    this.plans = new DietPlanRepository(this.db);
    this.assignments = new MemberDietPlanRepository(this.db);
    this.auditLog = new AuditLogRepository(this.db);
  }

  // ── Plan CRUD ────────────────────────────────────────────────────────────

  async list(query: ListDietPlansQuery) {
    const { items, total } = await this.plans.list(this.tenantId, query);
    return { items: items.map(toListDto), total, page: query.page, limit: query.limit, totalPages: Math.max(1, Math.ceil(total / query.limit)) };
  }

  async listAssignable(): Promise<DietPlanListItemDto[]> {
    return (await this.plans.listAssignable(this.tenantId)).map(toListDto);
  }

  async getById(planId: string): Promise<DietPlanDetailDto> {
    return toDetailDto(await this.mustFind(planId));
  }

  async create(input: CreateDietPlanInput, actor: IamActor): Promise<DietPlanDetailDto> {
    await this.assertNameAvailable(input.name);
    if (input.trainerId) await this.assertTrainerActive(input.trainerId);

    const plan = await this.plans.create({
      tenantId: this.tenantId,
      name: input.name,
      description: input.description,
      goal: input.goal,
      dailyCalories: input.dailyCalories,
      durationDays: input.durationDays,
      trainerId: input.trainerId,
      isActive: input.isActive ?? true,
      notes: input.notes,
    });
    await this.audit(actor, 'diet_plan.created', plan.id);
    return toDetailDto(plan);
  }

  async update(planId: string, input: UpdateDietPlanInput, actor: IamActor): Promise<DietPlanDetailDto> {
    const existing = await this.mustFind(planId);
    if (input.name && input.name.toLowerCase() !== existing.name.toLowerCase()) await this.assertNameAvailable(input.name);
    if (input.trainerId) await this.assertTrainerActive(input.trainerId);

    await this.plans.update(planId, {
      name: input.name,
      description: input.description,
      goal: input.goal,
      dailyCalories: input.dailyCalories,
      durationDays: input.durationDays,
      trainerId: input.trainerId,
      isActive: input.isActive,
      notes: input.notes,
    });
    await this.audit(actor, 'diet_plan.updated', planId);
    return this.getById(planId);
  }

  async setMeals(planId: string, meals: PlanMealInput[], actor: IamActor): Promise<DietPlanDetailDto> {
    await this.mustFind(planId);
    if (meals.length > 0) {
      const ids = [...new Set(meals.map((m) => m.foodId))];
      const found = await this.db.food.count({ where: { tenantId: this.tenantId, id: { in: ids }, deletedAt: null } });
      if (found !== ids.length) throw new NotFoundError('One or more selected foods do not exist.');
    }
    await this.plans.replaceMeals(this.tenantId, planId, meals);
    await this.audit(actor, 'diet_plan.meals_updated', planId);
    return this.getById(planId);
  }

  async activate(planId: string, actor: IamActor): Promise<void> {
    await this.mustFind(planId);
    await this.plans.setActive(planId, true);
    await this.audit(actor, 'diet_plan.activated', planId);
  }

  async deactivate(planId: string, actor: IamActor): Promise<void> {
    await this.mustFind(planId);
    await this.plans.setActive(planId, false);
    await this.audit(actor, 'diet_plan.deactivated', planId);
  }

  async softDelete(planId: string, actor: IamActor): Promise<void> {
    await this.mustFind(planId);
    await this.plans.softDelete(planId);
    await this.audit(actor, 'diet_plan.deleted', planId);
  }

  async restore(planId: string, actor: IamActor): Promise<DietPlanDetailDto> {
    const plan = await this.mustFind(planId, { includeDeleted: true });
    if (!plan.deletedAt) throw new ConflictError(ErrorCode.CONFLICT, 'This plan is not deleted.');
    await this.plans.restore(planId);
    await this.audit(actor, 'diet_plan.restored', planId);
    return this.getById(planId);
  }

  async duplicate(planId: string, actor: IamActor): Promise<DietPlanDetailDto> {
    const source = await this.mustFind(planId);
    let name = `${source.name} (Copy)`;
    let suffix = 2;
    while (await this.plans.findByName(this.tenantId, name)) {
      name = `${source.name} (Copy ${suffix})`;
      suffix += 1;
    }

    const plan = await this.plans.create({
      tenantId: this.tenantId,
      name,
      description: source.description,
      goal: source.goal,
      dailyCalories: source.dailyCalories,
      durationDays: source.durationDays,
      trainerId: source.trainerId,
      isActive: false,
      notes: source.notes,
    });
    if (source.meals.length > 0) {
      await this.plans.replaceMeals(
        this.tenantId,
        plan.id,
        source.meals.map((m) => ({
          foodId: m.foodId,
          mealType: m.mealType,
          quantity: Number(m.quantity),
          notes: m.notes ?? undefined,
        })),
      );
    }
    await this.audit(actor, 'diet_plan.duplicated', plan.id);
    return this.getById(plan.id);
  }

  // ── Member assignment & progress ────────────────────────────────────────

  async assign(planId: string, input: AssignDietPlanInput, actor: IamActor): Promise<MemberDietPlanDto> {
    const plan = await this.mustFind(planId);
    if (!plan.isActive) throw new ConflictError(ErrorCode.CONFLICT, 'This diet plan is inactive and cannot be assigned.');

    const member = await this.db.member.findFirst({ where: { tenantId: this.tenantId, id: input.memberId, deletedAt: null } });
    if (!member) throw new NotFoundError('Member not found.');

    const startDate = new Date(input.startDate);
    if (Number.isNaN(startDate.getTime())) throw new ValidationError('Invalid start date.');
    const endDate = input.endDate ? new Date(input.endDate) : undefined;
    if (endDate && Number.isNaN(endDate.getTime())) throw new ValidationError('Invalid end date.');

    // Only one active plan per member — superseding preserves history, same pattern as `Membership`/`MemberWorkoutPlan`.
    const current = await this.assignments.findActiveByMember(this.tenantId, input.memberId);
    if (current) await this.assignments.setStatus(current.id, 'COMPLETED');

    const assignment = await this.assignments.create({
      tenantId: this.tenantId,
      memberId: input.memberId,
      dietPlanId: planId,
      startDate,
      endDate,
      status: 'ACTIVE',
      trainerRemarks: input.trainerRemarks,
      memberNotes: input.memberNotes,
      assignedBy: actor.userId,
    });
    await this.audit(actor, 'diet_plan.assigned', assignment.id);
    return toAssignmentDto(assignment);
  }

  async remove(assignmentId: string, actor: IamActor): Promise<void> {
    const assignment = await this.mustFindAssignment(assignmentId);
    if (assignment.status !== 'ACTIVE') throw new ConflictError(ErrorCode.CONFLICT, 'This assignment is not active.');
    await this.assignments.setStatus(assignmentId, 'CANCELLED');
    await this.audit(actor, 'diet_plan.removed', assignmentId);
  }

  async updateAssignment(assignmentId: string, input: UpdateMemberDietPlanInput, actor: IamActor): Promise<MemberDietPlanDto> {
    await this.mustFindAssignment(assignmentId);
    await this.assignments.update(assignmentId, {
      startDate: input.startDate ? new Date(input.startDate) : undefined,
      endDate: input.endDate === null ? null : input.endDate ? new Date(input.endDate) : undefined,
      trainerRemarks: input.trainerRemarks,
      memberNotes: input.memberNotes,
    });
    await this.audit(actor, 'diet_plan.assignment_updated', assignmentId);
    return toAssignmentDto((await this.assignments.findById(this.tenantId, assignmentId))!);
  }

  /** Current active assignment + full history for one member. */
  async getMemberDietPlans(memberId: string): Promise<{ current: MemberDietPlanDto | null; history: MemberDietPlanDto[] }> {
    const rows = await this.assignments.listByMember(this.tenantId, memberId);
    const dtos = rows.map(toAssignmentDto);
    return { current: dtos.find((d) => d.status === 'ACTIVE') ?? null, history: dtos };
  }

  /**
   * Upserts one day's log — merges the incoming fields against whatever was
   * already logged for that date (a partial `mealsStatus` update, e.g.
   * marking just Breakfast complete, must NOT wipe an already-logged Lunch
   * for the same day; likewise water/weight/notes are only overwritten when
   * actually provided).
   */
  async updateProgress(assignmentId: string, input: UpdateDietProgressInput, actor: IamActor): Promise<MemberDietPlanDto> {
    const assignment = await this.mustFindAssignment(assignmentId);
    const date = new Date(input.date);
    if (Number.isNaN(date.getTime())) throw new ValidationError('Invalid date.');

    const planMealTypes = new Set(assignment.dietPlan.meals.map((m) => m.mealType));
    if (input.mealsStatus) {
      for (const mealType of Object.keys(input.mealsStatus)) {
        if (!planMealTypes.has(mealType as MealType)) throw new ValidationError(`"${mealType}" is not part of the assigned diet plan.`);
      }
    }

    const dateStr = date.toISOString().slice(0, 10);
    const existingLog = assignment.dailyLogs.find((log) => log.date.toISOString().slice(0, 10) === dateStr);
    const existingMealsStatus = (existingLog?.mealsStatus as Record<string, string> | null) ?? {};

    await this.assignments.upsertDailyLog(this.tenantId, assignmentId, date, {
      waterIntakeMl: input.waterIntakeMl ?? existingLog?.waterIntakeMl ?? undefined,
      weightKg: input.weightKg ?? (existingLog?.weightKg ? Number(existingLog.weightKg) : undefined),
      mealsStatus: { ...existingMealsStatus, ...input.mealsStatus } as Prisma.InputJsonValue,
      notes: input.notes ?? existingLog?.notes ?? undefined,
    });
    await this.audit(actor, 'diet_plan.progress_updated', assignmentId);
    return toAssignmentDto((await this.assignments.findById(this.tenantId, assignmentId))!);
  }

  // ── internals ───────────────────────────────────────────────────────────

  private async mustFind(planId: string, opts?: { includeDeleted?: boolean }): Promise<DietPlanDetailRow> {
    const plan = await this.plans.findById(this.tenantId, planId, opts);
    if (!plan) throw new NotFoundError('Diet plan not found.');
    return plan;
  }

  private async mustFindAssignment(assignmentId: string): Promise<MemberDietPlanRow> {
    const assignment = await this.assignments.findById(this.tenantId, assignmentId);
    if (!assignment) throw new NotFoundError('Diet plan assignment not found.');
    return assignment;
  }

  private async assertNameAvailable(name: string): Promise<void> {
    const existing = await this.plans.findByName(this.tenantId, name);
    if (existing) throw new ConflictError(ErrorCode.CONFLICT, 'A diet plan with this name already exists.');
  }

  /** Business rule: only an ACTIVE trainer can create or manage a diet plan. */
  private async assertTrainerActive(trainerId: string): Promise<void> {
    const trainer = await this.db.user.findFirst({
      where: { id: trainerId, tenantId: this.tenantId, deletedAt: null, userRoles: { some: { role: { name: 'TRAINER' } } } },
    });
    if (!trainer) throw new NotFoundError('Selected trainer does not exist or is not a Trainer.');
    if (trainer.status !== 'ACTIVE') throw new ConflictError(ErrorCode.CONFLICT, 'Only active trainers can be assigned to create or manage a diet plan.');
  }

  private async audit(actor: IamActor, action: string, entityId: string): Promise<void> {
    await this.auditLog.record({
      tenantId: this.tenantId,
      actorUserId: actor.userId,
      actorRole: actor.role,
      action,
      entityType: 'diet_plan',
      entityId,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });
  }
}
