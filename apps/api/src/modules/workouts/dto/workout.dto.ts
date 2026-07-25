import type {
  ExerciseDifficultyLevel,
  MemberExerciseProgressStatus,
  MemberWorkoutPlanStatus,
  WeekDay,
  WorkoutLevel,
} from '@prisma/client';

export interface ExerciseDto {
  id: string;
  name: string;
  category: string | null;
  muscleGroup: string | null;
  equipment: string | null;
  difficultyLevel: ExerciseDifficultyLevel;
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

export interface CreateExerciseInput {
  name: string;
  category?: string;
  muscleGroup?: string;
  equipment?: string;
  difficultyLevel?: ExerciseDifficultyLevel;
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

export type UpdateExerciseInput = Partial<CreateExerciseInput>;

export interface ListExercisesQuery {
  page: number;
  limit: number;
  search?: string;
  category?: string;
  muscleGroup?: string;
  difficultyLevel?: ExerciseDifficultyLevel;
  isActive?: boolean;
  includeDeleted: boolean;
  sortBy: 'name' | 'category' | 'createdAt';
  sortDir: 'asc' | 'desc';
}

export interface PlanExerciseInput {
  exerciseId: string;
  dayOfWeek: WeekDay;
  sets?: number;
  repetitions?: number;
  restSeconds?: number;
  notes?: string;
}

export interface PlanExerciseDto {
  id: string;
  exercise: ExerciseDto;
  dayOfWeek: WeekDay;
  sortOrder: number;
  sets: number | null;
  repetitions: number | null;
  restSeconds: number | null;
  notes: string | null;
}

export interface TrainerSummaryDto {
  id: string;
  name: string;
}

export interface WorkoutPlanListItemDto {
  id: string;
  name: string;
  goal: string | null;
  level: WorkoutLevel;
  durationWeeks: number;
  trainer: TrainerSummaryDto | null;
  isActive: boolean;
  activeMemberCount: number;
  createdAt: string;
  deletedAt: string | null;
}

export interface WorkoutPlanDetailDto extends WorkoutPlanListItemDto {
  description: string | null;
  notes: string | null;
  updatedAt: string;
  exercises: PlanExerciseDto[];
}

export interface CreateWorkoutPlanInput {
  name: string;
  description?: string;
  goal?: string;
  level?: WorkoutLevel;
  durationWeeks: number;
  trainerId?: string;
  isActive?: boolean;
  notes?: string;
}

export type UpdateWorkoutPlanInput = Partial<CreateWorkoutPlanInput>;

export interface ListWorkoutPlansQuery {
  page: number;
  limit: number;
  search?: string;
  level?: WorkoutLevel;
  trainerId?: string;
  isActive?: boolean;
  includeDeleted: boolean;
  sortBy: 'name' | 'durationWeeks' | 'createdAt';
  sortDir: 'asc' | 'desc';
}

export interface AssignWorkoutPlanInput {
  memberId: string;
  startDate: string;
  endDate?: string;
  trainerRemarks?: string;
  memberNotes?: string;
}

export interface UpdateMemberWorkoutPlanInput {
  startDate?: string;
  endDate?: string | null;
  trainerRemarks?: string;
  memberNotes?: string;
}

export interface MarkProgressInput {
  exerciseId: string;
  status: MemberExerciseProgressStatus;
  notes?: string;
}

export interface ExerciseProgressDto {
  exerciseId: string;
  exerciseName: string;
  dayOfWeek: WeekDay;
  status: MemberExerciseProgressStatus;
  notes: string | null;
  markedAt: string | null;
}

export interface MemberWorkoutPlanDto {
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
  progress: ExerciseProgressDto[];
  createdAt: string;
  updatedAt: string;
}
