import type { MealType, MemberDietPlanStatus } from '@prisma/client';

export interface FoodDto {
  id: string;
  name: string;
  category: string | null;
  servingSize: string | null;
  calories: number | null;
  protein: string | null;
  carbohydrates: string | null;
  fat: string | null;
  fiber: string | null;
  sugar: string | null;
  sodium: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface CreateFoodInput {
  name: string;
  category?: string;
  servingSize?: string;
  calories?: number;
  protein?: number;
  carbohydrates?: number;
  fat?: number;
  fiber?: number;
  sugar?: number;
  sodium?: number;
  notes?: string;
  isActive?: boolean;
}

export type UpdateFoodInput = Partial<CreateFoodInput>;

export interface ListFoodsQuery {
  page: number;
  limit: number;
  search?: string;
  category?: string;
  isActive?: boolean;
  includeDeleted: boolean;
  sortBy: 'name' | 'category' | 'createdAt';
  sortDir: 'asc' | 'desc';
}

export interface PlanMealInput {
  foodId: string;
  mealType: MealType;
  quantity?: number;
  notes?: string;
}

export interface PlanMealDto {
  id: string;
  food: FoodDto;
  mealType: MealType;
  sortOrder: number;
  quantity: string;
  notes: string | null;
}

export interface TrainerSummaryDto {
  id: string;
  name: string;
}

export interface DietPlanListItemDto {
  id: string;
  name: string;
  goal: string | null;
  dailyCalories: number | null;
  durationDays: number;
  trainer: TrainerSummaryDto | null;
  isActive: boolean;
  activeMemberCount: number;
  createdAt: string;
  deletedAt: string | null;
}

export interface DietPlanDetailDto extends DietPlanListItemDto {
  description: string | null;
  notes: string | null;
  updatedAt: string;
  meals: PlanMealDto[];
}

export interface CreateDietPlanInput {
  name: string;
  description?: string;
  goal?: string;
  dailyCalories?: number;
  durationDays: number;
  trainerId?: string;
  isActive?: boolean;
  notes?: string;
}

export type UpdateDietPlanInput = Partial<CreateDietPlanInput>;

export interface ListDietPlansQuery {
  page: number;
  limit: number;
  search?: string;
  trainerId?: string;
  isActive?: boolean;
  includeDeleted: boolean;
  sortBy: 'name' | 'durationDays' | 'createdAt';
  sortDir: 'asc' | 'desc';
}

export interface AssignDietPlanInput {
  memberId: string;
  startDate: string;
  endDate?: string;
  trainerRemarks?: string;
  memberNotes?: string;
}

export interface UpdateMemberDietPlanInput {
  startDate?: string;
  endDate?: string | null;
  trainerRemarks?: string;
  memberNotes?: string;
}

export interface UpdateDietProgressInput {
  date: string;
  waterIntakeMl?: number;
  weightKg?: number;
  mealsStatus?: Partial<Record<MealType, 'PENDING' | 'COMPLETED' | 'SKIPPED'>>;
  notes?: string;
}

export interface DailyLogDto {
  date: string;
  waterIntakeMl: number | null;
  weightKg: string | null;
  mealsStatus: Partial<Record<MealType, 'PENDING' | 'COMPLETED' | 'SKIPPED'>>;
  notes: string | null;
  updatedAt: string;
}

export interface MemberDietPlanDto {
  id: string;
  member: { id: string; memberId: string; name: string };
  dietPlan: { id: string; name: string; dailyCalories: number | null; durationDays: number; mealTypes: MealType[] };
  assignedDate: string;
  startDate: string;
  endDate: string | null;
  status: MemberDietPlanStatus;
  trainerRemarks: string | null;
  memberNotes: string | null;
  progressPercent: number;
  daysLogged: number;
  latestWeightKg: string | null;
  latestWaterIntakeMl: number | null;
  dailyLogs: DailyLogDto[];
  createdAt: string;
  updatedAt: string;
}
