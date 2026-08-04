-- CreateEnum
CREATE TYPE "JobCategory" AS ENUM ('MEMBERSHIP', 'ATTENDANCE', 'PAYMENT', 'NOTIFICATION', 'REPORT', 'MAINTENANCE');

-- CreateEnum
CREATE TYPE "JobRunStatus" AS ENUM ('PENDING', 'SCHEDULED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED', 'PAUSED');

-- CreateEnum
CREATE TYPE "JobTriggerType" AS ENUM ('SCHEDULED', 'MANUAL', 'RETRY');

-- CreateTable
CREATE TABLE "scheduled_jobs" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "category" "JobCategory" NOT NULL,
    "queue_name" VARCHAR(60) NOT NULL,
    "cron_pattern" VARCHAR(60) NOT NULL,
    "timezone" VARCHAR(60) NOT NULL DEFAULT 'UTC',
    "status" "JobRunStatus" NOT NULL DEFAULT 'SCHEDULED',
    "is_paused" BOOLEAN NOT NULL DEFAULT false,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "max_retries" INTEGER NOT NULL DEFAULT 3,
    "retry_delay_ms" INTEGER NOT NULL DEFAULT 60000,
    "timeout_ms" INTEGER NOT NULL DEFAULT 300000,
    "last_run_at" TIMESTAMP(3),
    "last_status" "JobRunStatus",
    "next_run_at" TIMESTAMP(3),
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scheduled_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_executions" (
    "id" UUID NOT NULL,
    "job_id" UUID NOT NULL,
    "job_name" VARCHAR(100) NOT NULL,
    "status" "JobRunStatus" NOT NULL,
    "trigger" "JobTriggerType" NOT NULL,
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "tenant_id" UUID,
    "triggered_by" UUID,
    "started_at" TIMESTAMP(3) NOT NULL,
    "finished_at" TIMESTAMP(3),
    "duration_ms" INTEGER,
    "result" JSONB,
    "error" TEXT,

    CONSTRAINT "job_executions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "scheduled_jobs_name_key" ON "scheduled_jobs"("name");

-- CreateIndex
CREATE INDEX "scheduled_jobs_category_idx" ON "scheduled_jobs"("category");

-- CreateIndex
CREATE INDEX "job_executions_job_id_started_at_idx" ON "job_executions"("job_id", "started_at");

-- CreateIndex
CREATE INDEX "job_executions_status_idx" ON "job_executions"("status");

-- AddForeignKey
ALTER TABLE "job_executions" ADD CONSTRAINT "job_executions_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "scheduled_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
