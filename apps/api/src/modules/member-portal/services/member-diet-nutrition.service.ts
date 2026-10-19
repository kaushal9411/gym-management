import { NotFoundError } from '../../../core/errors/app-error';
import { getTenantScopedClient, type TenantScopedPrisma } from '../../../infrastructure/database/tenant-scoped-client';
import { dateInTimezone } from '../../attendance/utils/timezone.util';
import { buildDietInsights } from '../utils/member-diet-insights.util';
import { buildNutritionBase, type DietLogInput, type DietNutritionDto, type PlanItemInput } from '../utils/member-nutrition.util';

const num = (v: { toString(): string } | number | null | undefined): number | null => {
  if (v === null || v === undefined) return null;
  const n = Number(v.toString());
  return Number.isFinite(n) ? n : null;
};

interface AssignmentLike {
  startDate: Date;
  dietPlan: { id: string; dailyCalories: number | null };
  dailyLogs: Array<{
    date: Date;
    waterIntakeMl: number | null;
    weightKg: { toString(): string } | null;
    mealsStatus: unknown;
  }>;
}

/**
 * Read model behind the additive `nutrition` block of `GET /portal/diet` and
 * the log response: what the member ate (completed meals x plan foods),
 * 14-day history, weekly summary, streak and rule-based advice. All maths
 * lives in `utils/member-nutrition.util.ts` + `member-diet-insights.util.ts`.
 */
export class MemberDietNutritionService {
  private readonly db: TenantScopedPrisma;

  constructor(private readonly tenantId: string) {
    this.db = getTenantScopedClient(tenantId);
  }

  /** The member's branch-local calendar date. */
  async today(memberId: string): Promise<string> {
    const member = await this.db.member.findFirst({
      where: { tenantId: this.tenantId, id: memberId, deletedAt: null },
      select: { branch: { select: { timezone: true } } },
    });
    if (!member) throw new NotFoundError('Member not found.');
    return dateInTimezone(member.branch.timezone || 'UTC');
  }

  async build(memberId: string, assignment: AssignmentLike): Promise<DietNutritionDto> {
    const [today, rows] = await Promise.all([
      this.today(memberId),
      this.db.dietPlanMeal.findMany({
        where: { tenantId: this.tenantId, planId: assignment.dietPlan.id },
        orderBy: [{ mealType: 'asc' }, { sortOrder: 'asc' }],
        include: { food: true },
      }),
    ]);
    const items: PlanItemInput[] = rows.map((r) => ({
      mealType: r.mealType,
      sortOrder: r.sortOrder,
      quantity: num(r.quantity) ?? 1,
      food: {
        name: r.food.name,
        servingSize: r.food.servingSize,
        calories: r.food.calories,
        protein: num(r.food.protein),
        carbohydrates: num(r.food.carbohydrates),
        fat: num(r.food.fat),
        fiber: num(r.food.fiber),
        sugar: num(r.food.sugar),
        sodium: num(r.food.sodium),
      },
    }));
    const logs: DietLogInput[] = assignment.dailyLogs.map((l) => ({
      date: l.date.toISOString().slice(0, 10),
      waterIntakeMl: l.waterIntakeMl,
      weightKg: num(l.weightKg),
      mealsStatus: l.mealsStatus && typeof l.mealsStatus === 'object' ? (l.mealsStatus as Record<string, string>) : null,
    }));
    const base = buildNutritionBase({
      items,
      logs,
      startDate: assignment.startDate.toISOString().slice(0, 10),
      today,
      dailyCalories: assignment.dietPlan.dailyCalories,
    });
    return { ...base, insights: buildDietInsights(base) };
  }
}
