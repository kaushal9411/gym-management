import { describe, expect, it } from 'vitest';

import {
  assignWorkoutPlanSchema,
  createExerciseSchema,
  createWorkoutPlanSchema,
  listExercisesQuerySchema,
  listWorkoutPlansQuerySchema,
  markProgressSchema,
  setPlanExercisesSchema,
  updateExerciseSchema,
  updateMemberWorkoutPlanSchema,
  updateWorkoutPlanSchema,
} from './workout.validators';

describe('workout validators', () => {
  describe('createExerciseSchema', () => {
    it('accepts a minimal valid payload', () => {
      expect(createExerciseSchema.safeParse({ name: 'Push-up' }).success).toBe(true);
    });

    it('rejects a missing name', () => {
      expect(createExerciseSchema.safeParse({}).success).toBe(false);
    });

    it('rejects an unknown difficulty level', () => {
      expect(createExerciseSchema.safeParse({ name: 'Push-up', difficultyLevel: 'EXPERT' }).success).toBe(false);
    });

    it('accepts every currently-supported difficulty level', () => {
      for (const difficultyLevel of ['BEGINNER', 'INTERMEDIATE', 'ADVANCED']) {
        expect(createExerciseSchema.safeParse({ name: 'Push-up', difficultyLevel }).success).toBe(true);
      }
    });

    it('rejects a non-data-URL imageUrl', () => {
      expect(createExerciseSchema.safeParse({ name: 'Push-up', imageUrl: 'https://example.com/pushup.png' }).success).toBe(false);
    });

    it('accepts a valid base64 image data URL', () => {
      const result = createExerciseSchema.safeParse({ name: 'Push-up', imageUrl: 'data:image/png;base64,iVBORw0KGgo=' });
      expect(result.success).toBe(true);
    });

    it('rejects a non-URL videoUrl (reference-only field)', () => {
      expect(createExerciseSchema.safeParse({ name: 'Push-up', videoUrl: 'not-a-url' }).success).toBe(false);
    });

    it('coerces numeric fields from strings', () => {
      const result = createExerciseSchema.safeParse({ name: 'Push-up', defaultSets: '3', defaultReps: '12', restSeconds: '60' });
      expect(result.success).toBe(true);
    });
  });

  describe('updateExerciseSchema', () => {
    it('rejects an empty body (nothing to update)', () => {
      expect(updateExerciseSchema.safeParse({}).success).toBe(false);
    });

    it('accepts a single-field partial update', () => {
      expect(updateExerciseSchema.safeParse({ isActive: false }).success).toBe(true);
    });
  });

  describe('listExercisesQuerySchema', () => {
    it('applies defaults for an empty query', () => {
      const result = listExercisesQuerySchema.parse({});
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.sortBy).toBe('name');
      expect(result.sortDir).toBe('asc');
    });

    it('rejects a limit above the max page size', () => {
      expect(listExercisesQuerySchema.safeParse({ limit: 500 }).success).toBe(false);
    });
  });

  describe('createWorkoutPlanSchema', () => {
    const base = { name: '8-Week Strength', durationWeeks: 8 };

    it('accepts a minimal valid payload', () => {
      expect(createWorkoutPlanSchema.safeParse(base).success).toBe(true);
    });

    it('rejects a missing durationWeeks', () => {
      expect(createWorkoutPlanSchema.safeParse({ name: '8-Week Strength' }).success).toBe(false);
    });

    it('rejects an unrealistic durationWeeks (over the 104-week cap)', () => {
      expect(createWorkoutPlanSchema.safeParse({ ...base, durationWeeks: 200 }).success).toBe(false);
    });

    it('rejects a non-uuid trainerId', () => {
      expect(createWorkoutPlanSchema.safeParse({ ...base, trainerId: 'not-a-uuid' }).success).toBe(false);
    });
  });

  describe('updateWorkoutPlanSchema', () => {
    it('rejects an empty body (nothing to update)', () => {
      expect(updateWorkoutPlanSchema.safeParse({}).success).toBe(false);
    });

    it('allows explicit null to clear trainerId', () => {
      expect(updateWorkoutPlanSchema.safeParse({ trainerId: null }).success).toBe(true);
    });
  });

  describe('listWorkoutPlansQuerySchema', () => {
    it('applies defaults for an empty query', () => {
      const result = listWorkoutPlansQuerySchema.parse({});
      expect(result.page).toBe(1);
      expect(result.sortBy).toBe('createdAt');
      expect(result.sortDir).toBe('desc');
    });

    it('rejects an unknown level', () => {
      expect(listWorkoutPlansQuerySchema.safeParse({ level: 'EXPERT' }).success).toBe(false);
    });
  });

  describe('setPlanExercisesSchema', () => {
    it('accepts an empty exercises array (a fully rest-day plan)', () => {
      expect(setPlanExercisesSchema.safeParse({ exercises: [] }).success).toBe(true);
    });

    it('rejects an exercise item with an invalid dayOfWeek', () => {
      const result = setPlanExercisesSchema.safeParse({
        exercises: [{ exerciseId: '11111111-1111-1111-1111-111111111111', dayOfWeek: 'FUNDAY' }],
      });
      expect(result.success).toBe(false);
    });

    it('accepts a valid weekly schedule item', () => {
      const result = setPlanExercisesSchema.safeParse({
        exercises: [{ exerciseId: '11111111-1111-1111-1111-111111111111', dayOfWeek: 'MONDAY', sets: 3, repetitions: 10 }],
      });
      expect(result.success).toBe(true);
    });
  });

  describe('assignWorkoutPlanSchema', () => {
    it('rejects a missing memberId', () => {
      expect(assignWorkoutPlanSchema.safeParse({ startDate: '2026-01-01' }).success).toBe(false);
    });

    it('accepts a minimal valid payload', () => {
      const result = assignWorkoutPlanSchema.safeParse({ memberId: '11111111-1111-1111-1111-111111111111', startDate: '2026-01-01' });
      expect(result.success).toBe(true);
    });
  });

  describe('updateMemberWorkoutPlanSchema', () => {
    it('rejects an empty body (nothing to update)', () => {
      expect(updateMemberWorkoutPlanSchema.safeParse({}).success).toBe(false);
    });

    it('allows explicit null to clear endDate', () => {
      expect(updateMemberWorkoutPlanSchema.safeParse({ endDate: null }).success).toBe(true);
    });
  });

  describe('markProgressSchema', () => {
    it('rejects an unknown status', () => {
      const result = markProgressSchema.safeParse({ exerciseId: '11111111-1111-1111-1111-111111111111', status: 'IN_PROGRESS' });
      expect(result.success).toBe(false);
    });

    it('accepts every currently-supported status', () => {
      for (const status of ['PENDING', 'COMPLETED', 'SKIPPED']) {
        const result = markProgressSchema.safeParse({ exerciseId: '11111111-1111-1111-1111-111111111111', status });
        expect(result.success).toBe(true);
      }
    });
  });
});
