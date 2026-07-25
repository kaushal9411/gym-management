import type { Paginated } from '@/features/iam/types';

export type { Paginated };

export type DifficultyLevel = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
export type WorkoutLevel = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
export type WeekDay = 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY';
export type MemberWorkoutPlanStatus = 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
export type ExerciseProgressStatus = 'PENDING' | 'COMPLETED' | 'SKIPPED';

export const WEEK_DAYS: WeekDay[] = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];

export interface Exercise {
  id: string;
  name: string;
  category: string | null;
  muscleGroup: string | null;
  equipment: string | null;
  difficultyLevel: DifficultyLevel;
  instructions: string | null;
  imageUrl: string | null;
  videoUrl: string | null;
  durationSeconds: number | null;
  defaultSets: number | null;
  defaultReps: number | null;
  restSeconds: number | null;
  caloriesBurnEstimate: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface CreateExercisePayload {
  name: string;
  category?: string;
  muscleGroup?: string;
  equipment?: string;
  difficultyLevel?: DifficultyLevel;
  instructions?: string;
  imageUrl?: string;
  videoUrl?: string;
  durationSeconds?: number;
  defaultSets?: number;
  defaultReps?: number;
  restSeconds?: number;
  caloriesBurnEstimate?: number;
  isActive?: boolean;
}

export type UpdateExercisePayload = Partial<CreateExercisePayload>;

export interface ListExercisesParams {
  page: number;
  limit: number;
  search?: string;
  category?: string;
  muscleGroup?: string;
  difficultyLevel?: DifficultyLevel;
  isActive?: boolean;
  includeDeleted?: boolean;
  sortBy?: 'name' | 'category' | 'createdAt';
  sortDir?: 'asc' | 'desc';
}

export interface PlanExerciseInput {
  exerciseId: string;
  dayOfWeek: WeekDay;
  sets?: number;
  repetitions?: number;
  restSeconds?: number;
  notes?: string;
}

export interface PlanExercise {
  id: string;
  exercise: Exercise;
  dayOfWeek: WeekDay;
  sortOrder: number;
  sets: number | null;
  repetitions: number | null;
  restSeconds: number | null;
  notes: string | null;
}

export interface TrainerSummary {
  id: string;
  name: string;
}

export interface WorkoutPlanListItem {
  id: string;
  name: string;
  goal: string | null;
  level: WorkoutLevel;
  durationWeeks: number;
  trainer: TrainerSummary | null;
  isActive: boolean;
  activeMemberCount: number;
  createdAt: string;
  deletedAt: string | null;
}

export interface WorkoutPlanDetail extends WorkoutPlanListItem {
  description: string | null;
  notes: string | null;
  updatedAt: string;
  exercises: PlanExercise[];
}

export interface CreateWorkoutPlanPayload {
  name: string;
  description?: string;
  goal?: string;
  level?: WorkoutLevel;
  durationWeeks: number;
  trainerId?: string;
  isActive?: boolean;
  notes?: string;
}

export type UpdateWorkoutPlanPayload = Partial<CreateWorkoutPlanPayload>;

export interface ListWorkoutPlansParams {
  page: number;
  limit: number;
  search?: string;
  level?: WorkoutLevel;
  trainerId?: string;
  isActive?: boolean;
  includeDeleted?: boolean;
  sortBy?: 'name' | 'durationWeeks' | 'createdAt';
  sortDir?: 'asc' | 'desc';
}

export interface AssignWorkoutPlanPayload {
  memberId: string;
  startDate: string;
  endDate?: string;
  trainerRemarks?: string;
  memberNotes?: string;
}

export interface UpdateMemberWorkoutPlanPayload {
  startDate?: string;
  endDate?: string | null;
  trainerRemarks?: string;
  memberNotes?: string;
}

export interface MarkProgressPayload {
  exerciseId: string;
  status: ExerciseProgressStatus;
  notes?: string;
}

export interface ExerciseProgress {
  exerciseId: string;
  exerciseName: string;
  dayOfWeek: WeekDay;
  status: ExerciseProgressStatus;
  notes: string | null;
  markedAt: string | null;
}

export interface MemberWorkoutPlan {
  id: string;
  member: { id: string; memberId: string; name: string };
  workoutPlan: { id: string; name: string; level: WorkoutLevel; durationWeeks: number };
  assignedDate: string;
  startDate: string;
  endDate: string | null;
  status: MemberWorkoutPlanStatus;
  trainerRemarks: string | null;
  memberNotes: string | null;
  progressPercent: number;
  completedCount: number;
  skippedCount: number;
  totalExercises: number;
  progress: ExerciseProgress[];
  createdAt: string;
  updatedAt: string;
}

export interface MemberWorkoutPlansResponse {
  current: MemberWorkoutPlan | null;
  history: MemberWorkoutPlan[];
}
