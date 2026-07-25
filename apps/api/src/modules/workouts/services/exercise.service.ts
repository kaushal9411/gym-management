import { ConflictError, NotFoundError } from '../../../core/errors/app-error';
import { ErrorCode } from '../../../core/errors/error-codes';
import { getTenantScopedClient } from '../../../infrastructure/database/tenant-scoped-client';
import { AuditLogRepository } from '../../authentication/repositories/audit-log.repository';
import type { IamActor } from '../../authentication/utils/actor.util';
import type { CreateExerciseInput, ExerciseDto, ListExercisesQuery, UpdateExerciseInput } from '../dto/workout.dto';
import { ExerciseRepository, type ExerciseRow } from '../repositories/exercise.repository';

function toDto(row: ExerciseRow): ExerciseDto {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    muscleGroup: row.muscleGroup,
    equipment: row.equipment,
    difficultyLevel: row.difficultyLevel,
    instructions: row.instructions,
    imageUrl: row.imageUrl,
    videoUrl: row.videoUrl,
    durationSeconds: row.durationSeconds,
    defaultSets: row.defaultSets,
    defaultReps: row.defaultReps,
    restSeconds: row.restSeconds,
    caloriesBurnEstimate: row.caloriesBurnEstimate,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: row.deletedAt?.toISOString() ?? null,
  };
}

export class ExerciseService {
  private readonly exercises: ExerciseRepository;
  private readonly auditLog: AuditLogRepository;

  constructor(private readonly tenantId: string) {
    const db = getTenantScopedClient(tenantId);
    this.exercises = new ExerciseRepository(db);
    this.auditLog = new AuditLogRepository(db);
  }

  async list(query: ListExercisesQuery) {
    const { items, total } = await this.exercises.list(this.tenantId, query);
    return { items: items.map(toDto), total, page: query.page, limit: query.limit, totalPages: Math.max(1, Math.ceil(total / query.limit)) };
  }

  /** Unfiltered active list — backs the exercise picker used when building a plan's weekly schedule. */
  async listActive(): Promise<ExerciseDto[]> {
    return (await this.exercises.listActive(this.tenantId)).map(toDto);
  }

  async getById(id: string): Promise<ExerciseDto> {
    return toDto(await this.mustFind(id));
  }

  async create(input: CreateExerciseInput, actor: IamActor): Promise<ExerciseDto> {
    await this.assertNameAvailable(input.name);
    const exercise = await this.exercises.create({
      tenantId: this.tenantId,
      name: input.name,
      category: input.category,
      muscleGroup: input.muscleGroup,
      equipment: input.equipment,
      difficultyLevel: input.difficultyLevel ?? 'BEGINNER',
      instructions: input.instructions,
      imageUrl: input.imageUrl,
      videoUrl: input.videoUrl,
      durationSeconds: input.durationSeconds,
      defaultSets: input.defaultSets,
      defaultReps: input.defaultReps,
      restSeconds: input.restSeconds,
      caloriesBurnEstimate: input.caloriesBurnEstimate,
      isActive: input.isActive ?? true,
    });
    await this.audit(actor, 'exercise.created', exercise.id);
    return toDto(exercise);
  }

  async update(id: string, input: UpdateExerciseInput, actor: IamActor): Promise<ExerciseDto> {
    const existing = await this.mustFind(id);
    if (input.name && input.name.toLowerCase() !== existing.name.toLowerCase()) await this.assertNameAvailable(input.name);

    await this.exercises.update(id, {
      name: input.name,
      category: input.category,
      muscleGroup: input.muscleGroup,
      equipment: input.equipment,
      difficultyLevel: input.difficultyLevel,
      instructions: input.instructions,
      imageUrl: input.imageUrl,
      videoUrl: input.videoUrl,
      durationSeconds: input.durationSeconds,
      defaultSets: input.defaultSets,
      defaultReps: input.defaultReps,
      restSeconds: input.restSeconds,
      caloriesBurnEstimate: input.caloriesBurnEstimate,
      isActive: input.isActive,
    });
    await this.audit(actor, 'exercise.updated', id);
    return this.getById(id);
  }

  async softDelete(id: string, actor: IamActor): Promise<void> {
    await this.mustFind(id);
    await this.exercises.softDelete(id);
    await this.audit(actor, 'exercise.deleted', id);
  }

  async restore(id: string, actor: IamActor): Promise<ExerciseDto> {
    const exercise = await this.mustFind(id, { includeDeleted: true });
    if (!exercise.deletedAt) throw new ConflictError(ErrorCode.CONFLICT, 'This exercise is not deleted.');
    await this.exercises.restore(id);
    await this.audit(actor, 'exercise.restored', id);
    return this.getById(id);
  }

  // ── internals ───────────────────────────────────────────────────────────

  private async mustFind(id: string, opts?: { includeDeleted?: boolean }): Promise<ExerciseRow> {
    const exercise = await this.exercises.findById(this.tenantId, id, opts);
    if (!exercise) throw new NotFoundError('Exercise not found.');
    return exercise;
  }

  private async assertNameAvailable(name: string): Promise<void> {
    const existing = await this.exercises.findByName(this.tenantId, name);
    if (existing) throw new ConflictError(ErrorCode.CONFLICT, 'An exercise with this name already exists.');
  }

  private async audit(actor: IamActor, action: string, entityId: string): Promise<void> {
    await this.auditLog.record({
      tenantId: this.tenantId,
      actorUserId: actor.userId,
      actorRole: actor.role,
      action,
      entityType: 'exercise',
      entityId,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });
  }
}
