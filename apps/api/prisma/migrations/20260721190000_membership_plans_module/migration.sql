-- Membership Plans module (Prompt 15) — expands `membership_plans` with
-- pricing/feature/rule fields. `plan_code` is added nullable first, backfilled
-- for any pre-existing rows (created back in Prompt 14 testing), then locked
-- to NOT NULL + unique — plain `prisma migrate dev` can't do this in one step
-- because non-interactive shells can't answer its "provide a default" prompt.

-- CreateEnum
CREATE TYPE "duration_type" AS ENUM ('DAYS', 'WEEKS', 'MONTHS', 'YEARS');

-- AlterTable
ALTER TABLE "membership_plans" ADD COLUMN     "access_branch_ids" JSONB,
ADD COLUMN     "auto_renewal_allowed" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "category" VARCHAR(60),
ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "diet_consultation_included" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "discount_percentage" DECIMAL(5,2) NOT NULL DEFAULT 0,
ADD COLUMN     "display_order" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "duration_type" "duration_type" NOT NULL DEFAULT 'MONTHS',
ADD COLUMN     "duration_value" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "freeze_allowed" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "freeze_days_limit" INTEGER,
ADD COLUMN     "grace_period_days" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "group_classes_included" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "guest_passes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "gym_access_all_branches" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "joining_fee" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "locker_access" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "max_age" INTEGER,
ADD COLUMN     "min_age" INTEGER,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "plan_code" VARCHAR(40),
ADD COLUMN     "pt_sessions_included" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "renewal_window_days" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "tax_percentage" DECIMAL(5,2) NOT NULL DEFAULT 0,
ADD COLUMN     "validity_end" DATE,
ADD COLUMN     "validity_start" DATE;

-- Backfill plan_code for any pre-existing rows: PLAN-0001, PLAN-0002, ... per tenant.
WITH numbered AS (
  SELECT id, tenant_id, ROW_NUMBER() OVER (PARTITION BY tenant_id ORDER BY created_at) AS rn
  FROM "membership_plans"
  WHERE plan_code IS NULL
)
UPDATE "membership_plans" mp
SET plan_code = 'PLAN-' || LPAD(numbered.rn::text, 4, '0')
FROM numbered
WHERE mp.id = numbered.id;

-- Lock plan_code down now that every row has a value.
ALTER TABLE "membership_plans" ALTER COLUMN "plan_code" SET NOT NULL;

-- CreateIndex
CREATE INDEX "membership_plans_tenant_id_display_order_idx" ON "membership_plans"("tenant_id", "display_order");

-- CreateIndex
CREATE UNIQUE INDEX "membership_plans_tenant_id_plan_code_key" ON "membership_plans"("tenant_id", "plan_code");
