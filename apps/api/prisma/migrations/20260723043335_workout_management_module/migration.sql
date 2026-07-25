-- CreateEnum
CREATE TYPE "exercise_difficulty_level" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED');

-- CreateEnum
CREATE TYPE "workout_level" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED');

-- CreateEnum
CREATE TYPE "week_day" AS ENUM ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY');

-- CreateEnum
CREATE TYPE "member_workout_plan_status" AS ENUM ('ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "member_exercise_progress_status" AS ENUM ('PENDING', 'COMPLETED', 'SKIPPED');

-- CreateTable
CREATE TABLE "exercises" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "category" VARCHAR(100),
    "muscle_group" VARCHAR(100),
    "equipment" VARCHAR(150),
    "difficulty_level" "exercise_difficulty_level" NOT NULL DEFAULT 'BEGINNER',
    "instructions" TEXT,
    "image_url" TEXT,
    "video_url" TEXT,
    "duration_seconds" INTEGER,
    "default_sets" INTEGER,
    "default_reps" INTEGER,
    "rest_seconds" INTEGER,
    "calories_burn_estimate" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "exercises_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workout_plans" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "description" TEXT,
    "goal" VARCHAR(150),
    "level" "workout_level" NOT NULL DEFAULT 'BEGINNER',
    "duration_weeks" INTEGER NOT NULL,
    "trainer_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "workout_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workout_plan_exercises" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "exercise_id" UUID NOT NULL,
    "day_of_week" "week_day" NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "sets" INTEGER,
    "repetitions" INTEGER,
    "rest_seconds" INTEGER,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workout_plan_exercises_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "member_workout_plans" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "member_id" UUID NOT NULL,
    "workout_plan_id" UUID NOT NULL,
    "assigned_date" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "start_date" DATE NOT NULL,
    "end_date" DATE,
    "status" "member_workout_plan_status" NOT NULL DEFAULT 'ACTIVE',
    "trainer_remarks" TEXT,
    "member_notes" TEXT,
    "assigned_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "member_workout_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "member_workout_progress" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "member_workout_plan_id" UUID NOT NULL,
    "exercise_id" UUID NOT NULL,
    "status" "member_exercise_progress_status" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "marked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "member_workout_progress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "exercises_tenant_id_is_active_idx" ON "exercises"("tenant_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "exercises_tenant_id_name_key" ON "exercises"("tenant_id", "name");

-- CreateIndex
CREATE INDEX "workout_plans_tenant_id_is_active_idx" ON "workout_plans"("tenant_id", "is_active");

-- CreateIndex
CREATE INDEX "workout_plans_tenant_id_trainer_id_idx" ON "workout_plans"("tenant_id", "trainer_id");

-- CreateIndex
CREATE INDEX "workout_plan_exercises_tenant_id_plan_id_day_of_week_idx" ON "workout_plan_exercises"("tenant_id", "plan_id", "day_of_week");

-- CreateIndex
CREATE INDEX "member_workout_plans_tenant_id_member_id_idx" ON "member_workout_plans"("tenant_id", "member_id");

-- CreateIndex
CREATE INDEX "member_workout_plans_tenant_id_workout_plan_id_idx" ON "member_workout_plans"("tenant_id", "workout_plan_id");

-- CreateIndex
CREATE INDEX "member_workout_plans_tenant_id_status_idx" ON "member_workout_plans"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "member_workout_progress_tenant_id_member_workout_plan_id_idx" ON "member_workout_progress"("tenant_id", "member_workout_plan_id");

-- CreateIndex
CREATE UNIQUE INDEX "member_workout_progress_member_workout_plan_id_exercise_id_key" ON "member_workout_progress"("member_workout_plan_id", "exercise_id");

-- AddForeignKey
ALTER TABLE "exercises" ADD CONSTRAINT "exercises_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_plans" ADD CONSTRAINT "workout_plans_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_plans" ADD CONSTRAINT "workout_plans_trainer_id_fkey" FOREIGN KEY ("trainer_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_plan_exercises" ADD CONSTRAINT "workout_plan_exercises_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_plan_exercises" ADD CONSTRAINT "workout_plan_exercises_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "workout_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_plan_exercises" ADD CONSTRAINT "workout_plan_exercises_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "exercises"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_workout_plans" ADD CONSTRAINT "member_workout_plans_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_workout_plans" ADD CONSTRAINT "member_workout_plans_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_workout_plans" ADD CONSTRAINT "member_workout_plans_workout_plan_id_fkey" FOREIGN KEY ("workout_plan_id") REFERENCES "workout_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_workout_plans" ADD CONSTRAINT "member_workout_plans_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_workout_progress" ADD CONSTRAINT "member_workout_progress_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_workout_progress" ADD CONSTRAINT "member_workout_progress_member_workout_plan_id_fkey" FOREIGN KEY ("member_workout_plan_id") REFERENCES "member_workout_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_workout_progress" ADD CONSTRAINT "member_workout_progress_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "exercises"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
