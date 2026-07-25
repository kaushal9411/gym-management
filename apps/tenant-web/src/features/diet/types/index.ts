import type { Paginated } from '@/features/iam/types';

export type { Paginated };

export type MealType = 'BREAKFAST' | 'MORNING_SNACK' | 'LUNCH' | 'EVENING_SNACK' | 'DINNER' | 'PRE_WORKOUT' | 'POST_WORKOUT';
export type MemberDietPlanStatus = 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
export type DietProgressStatus = 'PENDING' | 'COMPLETED' | 'SKIPPED';

export const MEAL_TYPES: MealType[] = ['BREAKFAST', 'MORNING_SNACK', 'LUNCH', 'EVENING_SNACK', 'DINNER', 'PRE_WORKOUT', 'POST_WORKOUT'];

export interface Food {
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

export interface CreateFoodPayload {
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

export type UpdateFoodPayload = Partial<CreateFoodPayload>;

export interface ListFoodsParams {
  page: number;
  limit: number;
  search?: string;
  category?: string;
  isActive?: boolean;
  includeDeleted?: boolean;
  sortBy?: 'name' | 'category' | 'createdAt';
  sortDir?: 'asc' | 'desc';
}

export interface PlanMealInput {
  foodId: string;
  mealType: MealType;
  quantity?: number;
  notes?: string;
}

export interface PlanMeal {
  id: string;
  food: Food;
  mealType: MealType;
  sortOrder: number;
  quantity: string;
  notes: string | null;
}

export interface TrainerSummary {
  id: string;
  name: string;
}

export interface DietPlanListItem {
  id: string;
  name: string;
  goal: string | null;
  dailyCalories: number | null;
  durationDays: number;
  trainer: TrainerSummary | null;
  isActive: boolean;
  activeMemberCount: number;
  createdAt: string;
  deletedAt: string | null;
}

export interface DietPlanDetail extends DietPlanListItem {
  description: string | null;
  notes: string | null;
  updatedAt: string;
  meals: PlanMeal[];
}

export interface CreateDietPlanPayload {
  name: string;
  description?: string;
  goal?: string;
  dailyCalories?: number;
  durationDays: number;
  trainerId?: string;
  isActive?: boolean;
  notes?: string;
}

export type UpdateDietPlanPayload = Partial<CreateDietPlanPayload>;

export interface ListDietPlansParams {
  page: number;
  limit: number;
  search?: string;
  trainerId?: string;
  isActive?: boolean;
  includeDeleted?: boolean;
  sortBy?: 'name' | 'durationDays' | 'createdAt';
  sortDir?: 'asc' | 'desc';
}

export interface AssignDietPlanPayload {
  memberId: string;
  startDate: string;
  endDate?: string;
  trainerRemarks?: string;
  memberNotes?: string;
}

export interface UpdateMemberDietPlanPayload {
  startDate?: string;
  endDate?: string | null;
  trainerRemarks?: string;
  memberNotes?: string;
}

export interface UpdateDietProgressPayload {
  date: string;
  waterIntakeMl?: number;
  weightKg?: number;
  mealsStatus?: Partial<Record<MealType, DietProgressStatus>>;
  notes?: string;
}

export interface DailyLog {
  date: string;
  waterIntakeMl: number | null;
  weightKg: string | null;
  mealsStatus: Partial<Record<MealType, DietProgressStatus>>;
  notes: string | null;
  updatedAt: string;
}

export interface MemberDietPlan {
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
  dailyLogs: DailyLog[];
  createdAt: string;
  updatedAt: string;
}

export interface MemberDietPlansResponse {
  current: MemberDietPlan | null;
  history: MemberDietPlan[];
}
