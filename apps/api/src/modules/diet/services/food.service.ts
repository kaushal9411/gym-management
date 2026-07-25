import { ConflictError, NotFoundError } from '../../../core/errors/app-error';
import { ErrorCode } from '../../../core/errors/error-codes';
import { getTenantScopedClient } from '../../../infrastructure/database/tenant-scoped-client';
import { AuditLogRepository } from '../../authentication/repositories/audit-log.repository';
import type { IamActor } from '../../authentication/utils/actor.util';
import type { CreateFoodInput, FoodDto, ListFoodsQuery, UpdateFoodInput } from '../dto/diet.dto';
import { FoodRepository, type FoodRow } from '../repositories/food.repository';

function toDto(row: FoodRow): FoodDto {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    servingSize: row.servingSize,
    calories: row.calories,
    protein: row.protein?.toString() ?? null,
    carbohydrates: row.carbohydrates?.toString() ?? null,
    fat: row.fat?.toString() ?? null,
    fiber: row.fiber?.toString() ?? null,
    sugar: row.sugar?.toString() ?? null,
    sodium: row.sodium?.toString() ?? null,
    notes: row.notes,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: row.deletedAt?.toISOString() ?? null,
  };
}

export class FoodService {
  private readonly foods: FoodRepository;
  private readonly auditLog: AuditLogRepository;

  constructor(private readonly tenantId: string) {
    const db = getTenantScopedClient(tenantId);
    this.foods = new FoodRepository(db);
    this.auditLog = new AuditLogRepository(db);
  }

  async list(query: ListFoodsQuery) {
    const { items, total } = await this.foods.list(this.tenantId, query);
    return { items: items.map(toDto), total, page: query.page, limit: query.limit, totalPages: Math.max(1, Math.ceil(total / query.limit)) };
  }

  /** Unfiltered active list — backs the food picker used when building a diet plan's meals. */
  async listActive(): Promise<FoodDto[]> {
    return (await this.foods.listActive(this.tenantId)).map(toDto);
  }

  async getById(id: string): Promise<FoodDto> {
    return toDto(await this.mustFind(id));
  }

  async create(input: CreateFoodInput, actor: IamActor): Promise<FoodDto> {
    await this.assertNameAvailable(input.name);
    const food = await this.foods.create({
      tenantId: this.tenantId,
      name: input.name,
      category: input.category,
      servingSize: input.servingSize,
      calories: input.calories,
      protein: input.protein,
      carbohydrates: input.carbohydrates,
      fat: input.fat,
      fiber: input.fiber,
      sugar: input.sugar,
      sodium: input.sodium,
      notes: input.notes,
      isActive: input.isActive ?? true,
    });
    await this.audit(actor, 'food.created', food.id);
    return toDto(food);
  }

  async update(id: string, input: UpdateFoodInput, actor: IamActor): Promise<FoodDto> {
    const existing = await this.mustFind(id);
    if (input.name && input.name.toLowerCase() !== existing.name.toLowerCase()) await this.assertNameAvailable(input.name);

    await this.foods.update(id, {
      name: input.name,
      category: input.category,
      servingSize: input.servingSize,
      calories: input.calories,
      protein: input.protein,
      carbohydrates: input.carbohydrates,
      fat: input.fat,
      fiber: input.fiber,
      sugar: input.sugar,
      sodium: input.sodium,
      notes: input.notes,
      isActive: input.isActive,
    });
    await this.audit(actor, 'food.updated', id);
    return this.getById(id);
  }

  async softDelete(id: string, actor: IamActor): Promise<void> {
    await this.mustFind(id);
    await this.foods.softDelete(id);
    await this.audit(actor, 'food.deleted', id);
  }

  async restore(id: string, actor: IamActor): Promise<FoodDto> {
    const food = await this.mustFind(id, { includeDeleted: true });
    if (!food.deletedAt) throw new ConflictError(ErrorCode.CONFLICT, 'This food is not deleted.');
    await this.foods.restore(id);
    await this.audit(actor, 'food.restored', id);
    return this.getById(id);
  }

  // ── internals ───────────────────────────────────────────────────────────

  private async mustFind(id: string, opts?: { includeDeleted?: boolean }): Promise<FoodRow> {
    const food = await this.foods.findById(this.tenantId, id, opts);
    if (!food) throw new NotFoundError('Food not found.');
    return food;
  }

  private async assertNameAvailable(name: string): Promise<void> {
    const existing = await this.foods.findByName(this.tenantId, name);
    if (existing) throw new ConflictError(ErrorCode.CONFLICT, 'A food with this name already exists.');
  }

  private async audit(actor: IamActor, action: string, entityId: string): Promise<void> {
    await this.auditLog.record({
      tenantId: this.tenantId,
      actorUserId: actor.userId,
      actorRole: actor.role,
      action,
      entityType: 'food',
      entityId,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });
  }
}
