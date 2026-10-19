-- Member workout self-tracking: per-day exercise log + per-day session metadata.
-- Additive. The existing member_workout_progress table (one overwritten row per
-- assignment+exercise) is untouched; the member plane mirrors the latest log
-- status into it so staff views and completion % keep working.
-- Hand-written (DDL + forced RLS) in one migration.

-- CreateEnum
CREATE TYPE "workout_log_status" AS ENUM ('COMPLETED', 'SKIPPED');

-- CreateTable
CREATE TABLE "member_workout_daily_logs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "member_id" UUID NOT NULL,
    "member_workout_plan_id" UUID NOT NULL,
    "exercise_id" UUID NOT NULL,
    "log_date" DATE NOT NULL,
    "status" "workout_log_status" NOT NULL,
    "sets_done" INTEGER,
    "reps_done" INTEGER,
    "weight_kg" DECIMAL(6,2),
    "duration_min" INTEGER,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "member_workout_daily_logs_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "member_workout_daily_logs_sets_done_check" CHECK ("sets_done" IS NULL OR "sets_done" BETWEEN 1 AND 100),
    CONSTRAINT "member_workout_daily_logs_reps_done_check" CHECK ("reps_done" IS NULL OR "reps_done" BETWEEN 1 AND 1000),
    CONSTRAINT "member_workout_daily_logs_weight_kg_check" CHECK ("weight_kg" IS NULL OR "weight_kg" > 0),
    CONSTRAINT "member_workout_daily_logs_duration_min_check" CHECK ("duration_min" IS NULL OR "duration_min" BETWEEN 1 AND 600)
);

-- CreateTable
CREATE TABLE "member_workout_session_logs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "member_id" UUID NOT NULL,
    "member_workout_plan_id" UUID NOT NULL,
    "log_date" DATE NOT NULL,
    "duration_min" INTEGER,
    "effort" INTEGER,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "member_workout_session_logs_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "member_workout_session_logs_duration_min_check" CHECK ("duration_min" IS NULL OR "duration_min" BETWEEN 1 AND 600),
    CONSTRAINT "member_workout_session_logs_effort_check" CHECK ("effort" IS NULL OR "effort" BETWEEN 1 AND 5)
);

-- CreateIndex
CREATE UNIQUE INDEX "member_workout_daily_logs_plan_exercise_date_key" ON "member_workout_daily_logs"("member_workout_plan_id", "exercise_id", "log_date");

-- CreateIndex
CREATE INDEX "member_workout_daily_logs_tenant_id_member_id_log_date_idx" ON "member_workout_daily_logs"("tenant_id", "member_id", "log_date");

-- CreateIndex
CREATE UNIQUE INDEX "member_workout_session_logs_member_id_log_date_key" ON "member_workout_session_logs"("member_id", "log_date");

-- CreateIndex
CREATE INDEX "member_workout_session_logs_tenant_id_member_id_log_date_idx" ON "member_workout_session_logs"("tenant_id", "member_id", "log_date");

-- AddForeignKey
ALTER TABLE "member_workout_daily_logs" ADD CONSTRAINT "member_workout_daily_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_workout_daily_logs" ADD CONSTRAINT "member_workout_daily_logs_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_workout_daily_logs" ADD CONSTRAINT "member_workout_daily_logs_member_workout_plan_id_fkey" FOREIGN KEY ("member_workout_plan_id") REFERENCES "member_workout_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_workout_daily_logs" ADD CONSTRAINT "member_workout_daily_logs_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "exercises"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_workout_session_logs" ADD CONSTRAINT "member_workout_session_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_workout_session_logs" ADD CONSTRAINT "member_workout_session_logs_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_workout_session_logs" ADD CONSTRAINT "member_workout_session_logs_member_workout_plan_id_fkey" FOREIGN KEY ("member_workout_plan_id") REFERENCES "member_workout_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Row-Level Security (forced; same policy shape as every tenant-scoped table)
ALTER TABLE "member_workout_daily_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "member_workout_daily_logs" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "member_workout_daily_logs"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

ALTER TABLE "member_workout_session_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "member_workout_session_logs" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "member_workout_session_logs"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
