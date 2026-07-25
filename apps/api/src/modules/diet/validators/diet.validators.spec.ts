import { describe, expect, it } from 'vitest';

import {
  assignDietPlanSchema,
  createDietPlanSchema,
  createFoodSchema,
  listDietPlansQuerySchema,
  listFoodsQuerySchema,
  setPlanMealsSchema,
  updateDietPlanSchema,
  updateDietProgressSchema,
  updateFoodSchema,
  updateMemberDietPlanSchema,
} from './diet.validators';

describe('diet validators', () => {
  describe('createFoodSchema', () => {
    it('accepts a minimal valid payload', () => {
      expect(createFoodSchema.safeParse({ name: 'Brown Rice' }).success).toBe(true);
    });

    it('rejects a missing name', () => {
      expect(createFoodSchema.safeParse({}).success).toBe(false);
    });

    it('coerces numeric nutrition fields from strings', () => {
      const result = createFoodSchema.safeParse({ name: 'Brown Rice', calories: '215', protein: '4.5', carbohydrates: '45' });
      expect(result.success).toBe(true);
    });

    it('rejects a negative calorie value', () => {
      expect(createFoodSchema.safeParse({ name: 'Brown Rice', calories: -50 }).success).toBe(false);
    });
  });

  describe('updateFoodSchema', () => {
    it('rejects an empty body (nothing to update)', () => {
      expect(updateFoodSchema.safeParse({}).success).toBe(false);
    });

    it('accepts a single-field partial update', () => {
      expect(updateFoodSchema.safeParse({ isActive: false }).success).toBe(true);
    });
  });

  describe('listFoodsQuerySchema', () => {
    it('applies defaults for an empty query', () => {
      const result = listFoodsQuerySchema.parse({});
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.sortBy).toBe('name');
      expect(result.sortDir).toBe('asc');
    });

    it('rejects a limit above the max page size', () => {
      expect(listFoodsQuerySchema.safeParse({ limit: 500 }).success).toBe(false);
    });
  });

  describe('createDietPlanSchema', () => {
    const base = { name: '30-Day Cut', durationDays: 30 };

    it('accepts a minimal valid payload', () => {
      expect(createDietPlanSchema.safeParse(base).success).toBe(true);
    });

    it('rejects a missing durationDays', () => {
      expect(createDietPlanSchema.safeParse({ name: '30-Day Cut' }).success).toBe(false);
    });

    it('rejects an unrealistic durationDays (over the 730-day cap)', () => {
      expect(createDietPlanSchema.safeParse({ ...base, durationDays: 1000 }).success).toBe(false);
    });

    it('rejects a non-uuid trainerId', () => {
      expect(createDietPlanSchema.safeParse({ ...base, trainerId: 'not-a-uuid' }).success).toBe(false);
    });
  });

  describe('updateDietPlanSchema', () => {
    it('rejects an empty body (nothing to update)', () => {
      expect(updateDietPlanSchema.safeParse({}).success).toBe(false);
    });

    it('allows explicit null to clear trainerId', () => {
      expect(updateDietPlanSchema.safeParse({ trainerId: null }).success).toBe(true);
    });
  });

  describe('listDietPlansQuerySchema', () => {
    it('applies defaults for an empty query', () => {
      const result = listDietPlansQuerySchema.parse({});
      expect(result.page).toBe(1);
      expect(result.sortBy).toBe('createdAt');
      expect(result.sortDir).toBe('desc');
    });
  });

  describe('setPlanMealsSchema', () => {
    it('accepts an empty meals array', () => {
      expect(setPlanMealsSchema.safeParse({ meals: [] }).success).toBe(true);
    });

    it('rejects a meal item with an invalid mealType', () => {
      const result = setPlanMealsSchema.safeParse({
        meals: [{ foodId: '11111111-1111-1111-1111-111111111111', mealType: 'BRUNCH' }],
      });
      expect(result.success).toBe(false);
    });

    it('accepts a valid meal item', () => {
      const result = setPlanMealsSchema.safeParse({
        meals: [{ foodId: '11111111-1111-1111-1111-111111111111', mealType: 'BREAKFAST', quantity: 1.5 }],
      });
      expect(result.success).toBe(true);
    });
  });

  describe('assignDietPlanSchema', () => {
    it('rejects a missing memberId', () => {
      expect(assignDietPlanSchema.safeParse({ startDate: '2026-01-01' }).success).toBe(false);
    });

    it('accepts a minimal valid payload', () => {
      const result = assignDietPlanSchema.safeParse({ memberId: '11111111-1111-1111-1111-111111111111', startDate: '2026-01-01' });
      expect(result.success).toBe(true);
    });
  });

  describe('updateMemberDietPlanSchema', () => {
    it('rejects an empty body (nothing to update)', () => {
      expect(updateMemberDietPlanSchema.safeParse({}).success).toBe(false);
    });

    it('allows explicit null to clear endDate', () => {
      expect(updateMemberDietPlanSchema.safeParse({ endDate: null }).success).toBe(true);
    });
  });

  describe('updateDietProgressSchema', () => {
    it('rejects a missing date', () => {
      expect(updateDietProgressSchema.safeParse({}).success).toBe(false);
    });

    it('accepts a partial mealsStatus update', () => {
      const result = updateDietProgressSchema.safeParse({ date: '2026-01-01', mealsStatus: { BREAKFAST: 'COMPLETED' } });
      expect(result.success).toBe(true);
    });

    it('rejects an unknown meal type key in mealsStatus', () => {
      const result = updateDietProgressSchema.safeParse({ date: '2026-01-01', mealsStatus: { BRUNCH: 'COMPLETED' } });
      expect(result.success).toBe(false);
    });

    it('accepts waterIntakeMl and weightKg', () => {
      const result = updateDietProgressSchema.safeParse({ date: '2026-01-01', waterIntakeMl: 2000, weightKg: 72.5 });
      expect(result.success).toBe(true);
    });
  });
});
