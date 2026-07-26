import { ConflictError, NotFoundError, ValidationError } from '../../../core/errors/app-error';
import { ErrorCode } from '../../../core/errors/error-codes';
import { getTenantScopedClient, type TenantScopedPrisma } from '../../../infrastructure/database/tenant-scoped-client';
import { AuditLogRepository } from '../../authentication/repositories/audit-log.repository';
import type { IamActor } from '../../authentication/utils/actor.util';
import { notifyWorkoutAssigned } from '../../tenant-notifications/services/notification-trigger.service';
import type {
  AssignWorkoutPlanInput,
  CreateWorkoutPlanInput,
  ExerciseProgressDto,
  ListWorkoutPlansQuery,
  MarkProgressInput,
  MemberWorkoutPlanDto,
  PlanExerciseDto,
  PlanExerciseInput,
  UpdateMemberWorkoutPlanInput,
  UpdateWorkoutPlanInput,
  WorkoutPlanDetailDto,
  WorkoutPlanListItemDto,
} from '../dto/workout.dto';
import { MemberWorkoutPlanRepository, type MemberWorkoutPlanRow } from '../repositories/member-workout-plan.repository';
import { WorkoutPlanRepository, type WorkoutPlanDetailRow, type WorkoutPlanListRow } from '../repositories/workout-plan.repository';

function toListDto(row: WorkoutPlanListRow): WorkoutPlanListItemDto {
  return {
    id: row.id,
    name: row.name,
    goal: row.goal,
    level: row.level,
    durationWeeks: row.durationWeeks,
    trainer: row.trainer ? { id: row.trainer.id, name: row.trainer.name } : null,
    isActive: row.isActive,
    activeMemberCount: row._count.members,
    createdAt: row.createdAt.toISOString(),
    deletedAt: row.deletedAt?.toISOString() ?? null,
  };
}

function toPlanExerciseDto(row: WorkoutPlanDetailRow['exercises'][number]): PlanExerciseDto {
  return {
    id: row.id,
    exercise: {
      id: row.exercise.id,
      name: row.exercise.name,
      category: row.exercise.category,
      muscleGroup: row.exercise.muscleGroup,
      equipment: row.exercise.equipment,
      difficultyLevel: row.exercise.difficultyLevel,
      instructions: row.exercise.instructions,
      imageUrl: row.exercise.imageUrl,
      videoUrl: row.exercise.videoUrl,
      durationSeconds: row.exercise.durationSeconds,
      defaultSets: row.exercise.defaultSets,
      defaultReps: row.exercise.defaultReps,
      restSeconds: row.exercise.restSeconds,
      caloriesBurnEstimate: row.exercise.caloriesBurnEstimate,
      isActive: row.exercise.isActive,
      createdAt: row.exercise.createdAt.toISOString(),
      updatedAt: row.exercise.updatedAt.toISOString(),
      deletedAt: row.exercise.deletedAt?.toISOString() ?? null,
    },
    dayOfWeek: row.dayOfWeek,
    sortOrder: row.sortOrder,
    sets: row.sets,
    repetitions: row.repetitions,
    restSeconds: row.restSeconds,
    notes: row.notes,
  };
}

function toDetailDto(row: WorkoutPlanDetailRow): WorkoutPlanDetailDto {
  return {
    ...toListDto(row),
    description: row.description,
    notes: row.notes,
    updatedAt: row.updatedAt.toISOString(),
    exercises: row.exercises.map(toPlanExerciseDto),
  };
}

function toAssignmentDto(row: MemberWorkoutPlanRow): MemberWorkoutPlanDto {
  const progressByExercise = new Map(row.progress.map((p) => [p.exerciseId, p]));
  const progress: ExerciseProgressDto[] = row.workoutPlan.exercises.map((planExercise) => {
    const p = progressByExercise.get(planExercise.exerciseId);
    return {
      exerciseId: planExercise.exerciseId,
      exerciseName: planExercise.exercise.name,
      dayOfWeek: planExercise.dayOfWeek,
      status: p?.status ?? 'PENDING',
      notes: p?.notes ?? null,
      markedAt: p?.markedAt?.toISOString() ?? null,
    };
  });
  const totalExercises = progress.length;
  const completedCount = progress.filter((p) => p.status === 'COMPLETED').length;
  const skippedCount = progress.filter((p) => p.status === 'SKIPPED').length;

  return {
    id: row.id,
    member: { id: row.member.id, memberId: row.member.memberId, name: `${row.member.firstName} ${row.member.lastName}`.trim() },
    workoutPlan: { id: row.workoutPlan.id, name: row.workoutPlan.name, level: row.workoutPlan.level, durationWeeks: row.workoutPlan.durationWeeks },
    assignedDate: row.assignedDate.toISOString().slice(0, 10),
    startDate: row.startDate.toISOString().slice(0, 10),
    endDate: row.endDate?.toISOString().slice(0, 10) ?? null,
    status: row.status,
    trainerRemarks: row.trainerRemarks,
    memberNotes: row.memberNotes,
    progressPercent: totalExercises === 0 ? 0 : Math.round((completedCount / totalExercises) * 100),
    completedCount,
    skippedCount,
    totalExercises,
    progress,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export class WorkoutPlanService {
  private readonly db: TenantScopedPrisma;
  private readonly plans: WorkoutPlanRepository;
  private readonly assignments: MemberWorkoutPlanRepository;
  private readonly auditLog: AuditLogRepository;

  constructor(private readonly tenantId: string) {
    this.db = getTenantScopedClient(tenantId);
    this.plans = new WorkoutPlanRepository(this.db);
    this.assignments = new MemberWorkoutPlanRepository(this.db);
    this.auditLog = new AuditLogRepository(this.db);
  }

  // ── Plan CRUD ────────────────────────────────────────────────────────────

  async list(query: ListWorkoutPlansQuery) {
    const { items, total } = await this.plans.list(this.tenantId, query);
    return { items: items.map(toListDto), total, page: query.page, limit: query.limit, totalPages: Math.max(1, Math.ceil(total / query.limit)) };
  }

  async listAssignable(): Promise<WorkoutPlanListItemDto[]> {
    return (await this.plans.listAssignable(this.tenantId)).map(toListDto);
  }

  async getById(planId: string): Promise<WorkoutPlanDetailDto> {
    return toDetailDto(await this.mustFind(planId));
  }

  async create(input: CreateWorkoutPlanInput, actor: IamActor): Promise<WorkoutPlanDetailDto> {
    await this.assertNameAvailable(input.name);
    if (input.trainerId) await this.assertTrainerActive(input.trainerId);

    const plan = await this.plans.create({
      tenantId: this.tenantId,
      name: input.name,
      description: input.description,
      goal: input.goal,
      level: input.level ?? 'BEGINNER',
      durationWeeks: input.durationWeeks,
      trainerId: input.trainerId,
      isActive: input.isActive ?? true,
      notes: input.notes,
    });
    await this.audit(actor, 'workout_plan.created', plan.id);
    return toDetailDto(plan);
  }

  async update(planId: string, input: UpdateWorkoutPlanInput, actor: IamActor): Promise<WorkoutPlanDetailDto> {
    const existing = await this.mustFind(planId);
    if (input.name && input.name.toLowerCase() !== existing.name.toLowerCase()) await this.assertNameAvailable(input.name);
    if (input.trainerId) await this.assertTrainerActive(input.trainerId);

    await this.plans.update(planId, {
      name: input.name,
      description: input.description,
      goal: input.goal,
      level: input.level,
      durationWeeks: input.durationWeeks,
      trainerId: input.trainerId,
      isActive: input.isActive,
      notes: input.notes,
    });
    await this.audit(actor, 'workout_plan.updated', planId);
    return this.getById(planId);
  }

  async setExercises(planId: string, exercises: PlanExerciseInput[], actor: IamActor): Promise<WorkoutPlanDetailDto> {
    await this.mustFind(planId);
    if (exercises.length > 0) {
      const ids = [...new Set(exercises.map((e) => e.exerciseId))];
      const found = await this.db.exercise.count({ where: { tenantId: this.tenantId, id: { in: ids }, deletedAt: null } });
      if (found !== ids.length) throw new NotFoundError('One or more selected exercises do not exist.');
    }
    await this.plans.replaceExercises(this.tenantId, planId, exercises);
    await this.audit(actor, 'workout_plan.exercises_updated', planId);
    return this.getById(planId);
  }

  async activate(planId: string, actor: IamActor): Promise<void> {
    await this.mustFind(planId);
    await this.plans.setActive(planId, true);
    await this.audit(actor, 'workout_plan.activated', planId);
  }

  async deactivate(planId: string, actor: IamActor): Promise<void> {
    await this.mustFind(planId);
    await this.plans.setActive(planId, false);
    await this.audit(actor, 'workout_plan.deactivated', planId);
  }

  async softDelete(planId: string, actor: IamActor): Promise<void> {
    await this.mustFind(planId);
    await this.plans.softDelete(planId);
    await this.audit(actor, 'workout_plan.deleted', planId);
  }

  async restore(planId: string, actor: IamActor): Promise<WorkoutPlanDetailDto> {
    const plan = await this.mustFind(planId, { includeDeleted: true });
    if (!plan.deletedAt) throw new ConflictError(ErrorCode.CONFLICT, 'This plan is not deleted.');
    await this.plans.restore(planId);
    await this.audit(actor, 'workout_plan.restored', planId);
    return this.getById(planId);
  }

  async duplicate(planId: string, actor: IamActor): Promise<WorkoutPlanDetailDto> {
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
      level: source.level,
      durationWeeks: source.durationWeeks,
      trainerId: source.trainerId,
      isActive: false,
      notes: source.notes,
    });
    if (source.exercises.length > 0) {
      await this.plans.replaceExercises(
        this.tenantId,
        plan.id,
        source.exercises.map((e) => ({
          exerciseId: e.exerciseId,
          dayOfWeek: e.dayOfWeek,
          sets: e.sets ?? undefined,
          repetitions: e.repetitions ?? undefined,
          restSeconds: e.restSeconds ?? undefined,
          notes: e.notes ?? undefined,
        })),
      );
    }
    await this.audit(actor, 'workout_plan.duplicated', plan.id);
    return this.getById(plan.id);
  }

  // ── Member assignment & progress ────────────────────────────────────────

  async assign(planId: string, input: AssignWorkoutPlanInput, actor: IamActor): Promise<MemberWorkoutPlanDto> {
    const plan = await this.mustFind(planId);
    if (!plan.isActive) throw new ConflictError(ErrorCode.CONFLICT, 'This workout plan is inactive and cannot be assigned.');

    const member = await this.db.member.findFirst({ where: { tenantId: this.tenantId, id: input.memberId, deletedAt: null } });
    if (!member) throw new NotFoundError('Member not found.');

    const startDate = new Date(input.startDate);
    if (Number.isNaN(startDate.getTime())) throw new ValidationError('Invalid start date.');
    const endDate = input.endDate ? new Date(input.endDate) : undefined;
    if (endDate && Number.isNaN(endDate.getTime())) throw new ValidationError('Invalid end date.');

    // Only one active plan per member — superseding preserves history, same pattern as `Membership`.
    const current = await this.assignments.findActiveByMember(this.tenantId, input.memberId);
    if (current) await this.assignments.setStatus(current.id, 'COMPLETED');

    const assignment = await this.assignments.create({
      tenantId: this.tenantId,
      memberId: input.memberId,
      workoutPlanId: planId,
      startDate,
      endDate,
      status: 'ACTIVE',
      trainerRemarks: input.trainerRemarks,
      memberNotes: input.memberNotes,
      assignedBy: actor.userId,
    });
    await this.audit(actor, 'workout_plan.assigned', assignment.id);
    await notifyWorkoutAssigned(this.tenantId, { memberName: `${member.firstName} ${member.lastName}`.trim(), planName: plan.name });
    return toAssignmentDto(assignment);
  }

  async remove(assignmentId: string, actor: IamActor): Promise<void> {
    const assignment = await this.mustFindAssignment(assignmentId);
    if (assignment.status !== 'ACTIVE') throw new ConflictError(ErrorCode.CONFLICT, 'This assignment is not active.');
    await this.assignments.setStatus(assignmentId, 'CANCELLED');
    await this.audit(actor, 'workout_plan.removed', assignmentId);
  }

  async updateAssignment(assignmentId: string, input: UpdateMemberWorkoutPlanInput, actor: IamActor): Promise<MemberWorkoutPlanDto> {
    await this.mustFindAssignment(assignmentId);
    await this.assignments.update(assignmentId, {
      startDate: input.startDate ? new Date(input.startDate) : undefined,
      endDate: input.endDate === null ? null : input.endDate ? new Date(input.endDate) : undefined,
      trainerRemarks: input.trainerRemarks,
      memberNotes: input.memberNotes,
    });
    await this.audit(actor, 'workout_plan.assignment_updated', assignmentId);
    return toAssignmentDto((await this.assignments.findById(this.tenantId, assignmentId))!);
  }

  /** Current active assignment + full history for one member. */
  async getMemberWorkoutPlans(memberId: string): Promise<{ current: MemberWorkoutPlanDto | null; history: MemberWorkoutPlanDto[] }> {
    const rows = await this.assignments.listByMember(this.tenantId, memberId);
    const dtos = rows.map(toAssignmentDto);
    return { current: dtos.find((d) => d.status === 'ACTIVE') ?? null, history: dtos };
  }

  async markProgress(assignmentId: string, input: MarkProgressInput, actor: IamActor): Promise<MemberWorkoutPlanDto> {
    const assignment = await this.mustFindAssignment(assignmentId);
    const belongsToPlan = assignment.workoutPlan.exercises.some((e) => e.exerciseId === input.exerciseId);
    if (!belongsToPlan) throw new ValidationError('This exercise is not part of the assigned workout plan.');

    await this.assignments.upsertProgress(this.tenantId, assignmentId, input.exerciseId, { status: input.status, notes: input.notes });
    await this.audit(actor, 'workout_plan.progress_marked', assignmentId);
    return toAssignmentDto((await this.assignments.findById(this.tenantId, assignmentId))!);
  }

  // ── internals ───────────────────────────────────────────────────────────

  private async mustFind(planId: string, opts?: { includeDeleted?: boolean }): Promise<WorkoutPlanDetailRow> {
    const plan = await this.plans.findById(this.tenantId, planId, opts);
    if (!plan) throw new NotFoundError('Workout plan not found.');
    return plan;
  }

  private async mustFindAssignment(assignmentId: string): Promise<MemberWorkoutPlanRow> {
    const assignment = await this.assignments.findById(this.tenantId, assignmentId);
    if (!assignment) throw new NotFoundError('Workout plan assignment not found.');
    return assignment;
  }

  private async assertNameAvailable(name: string): Promise<void> {
    const existing = await this.plans.findByName(this.tenantId, name);
    if (existing) throw new ConflictError(ErrorCode.CONFLICT, 'A workout plan with this name already exists.');
  }

  /** Business rule: only an ACTIVE trainer can author/manage a workout plan. */
  private async assertTrainerActive(trainerId: string): Promise<void> {
    const trainer = await this.db.user.findFirst({
      where: { id: trainerId, tenantId: this.tenantId, deletedAt: null, userRoles: { some: { role: { name: 'TRAINER' } } } },
    });
    if (!trainer) throw new NotFoundError('Selected trainer does not exist or is not a Trainer.');
    if (trainer.status !== 'ACTIVE') throw new ConflictError(ErrorCode.CONFLICT, 'Only active trainers can be assigned to manage a workout plan.');
  }

  private async audit(actor: IamActor, action: string, entityId: string): Promise<void> {
    await this.auditLog.record({
      tenantId: this.tenantId,
      actorUserId: actor.userId,
      actorRole: actor.role,
      action,
      entityType: 'workout_plan',
      entityId,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });
  }
}
