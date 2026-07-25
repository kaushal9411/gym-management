-- CreateEnum
CREATE TYPE "meal_type" AS ENUM ('BREAKFAST', 'MORNING_SNACK', 'LUNCH', 'EVENING_SNACK', 'DINNER', 'PRE_WORKOUT', 'POST_WORKOUT');

-- CreateEnum
CREATE TYPE "member_diet_plan_status" AS ENUM ('ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "foods" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "category" VARCHAR(100),
    "serving_size" VARCHAR(100),
    "calories" INTEGER,
    "protein" DECIMAL(6,2),
    "carbohydrates" DECIMAL(6,2),
    "fat" DECIMAL(6,2),
    "fiber" DECIMAL(6,2),
    "sugar" DECIMAL(6,2),
    "sodium" DECIMAL(7,2),
    "notes" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "foods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diet_plans" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "description" TEXT,
    "goal" VARCHAR(150),
    "daily_calories" INTEGER,
    "duration_days" INTEGER NOT NULL,
    "trainer_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "diet_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diet_plan_meals" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "food_id" UUID NOT NULL,
    "meal_type" "meal_type" NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "quantity" DECIMAL(5,2) NOT NULL DEFAULT 1,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "diet_plan_meals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "member_diet_plans" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "member_id" UUID NOT NULL,
    "diet_plan_id" UUID NOT NULL,
    "assigned_date" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "start_date" DATE NOT NULL,
    "end_date" DATE,
    "status" "member_diet_plan_status" NOT NULL DEFAULT 'ACTIVE',
    "trainer_remarks" TEXT,
    "member_notes" TEXT,
    "assigned_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "member_diet_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "member_diet_daily_logs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "member_diet_plan_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "water_intake_ml" INTEGER,
    "weight_kg" DECIMAL(5,2),
    "meals_status" JSONB,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "member_diet_daily_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "foods_tenant_id_is_active_idx" ON "foods"("tenant_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "foods_tenant_id_name_key" ON "foods"("tenant_id", "name");

-- CreateIndex
CREATE INDEX "diet_plans_tenant_id_is_active_idx" ON "diet_plans"("tenant_id", "is_active");

-- CreateIndex
CREATE INDEX "diet_plans_tenant_id_trainer_id_idx" ON "diet_plans"("tenant_id", "trainer_id");

-- CreateIndex
CREATE INDEX "diet_plan_meals_tenant_id_plan_id_meal_type_idx" ON "diet_plan_meals"("tenant_id", "plan_id", "meal_type");

-- CreateIndex
CREATE INDEX "member_diet_plans_tenant_id_member_id_idx" ON "member_diet_plans"("tenant_id", "member_id");

-- CreateIndex
CREATE INDEX "member_diet_plans_tenant_id_diet_plan_id_idx" ON "member_diet_plans"("tenant_id", "diet_plan_id");

-- CreateIndex
CREATE INDEX "member_diet_plans_tenant_id_status_idx" ON "member_diet_plans"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "member_diet_daily_logs_tenant_id_member_diet_plan_id_idx" ON "member_diet_daily_logs"("tenant_id", "member_diet_plan_id");

-- CreateIndex
CREATE UNIQUE INDEX "member_diet_daily_logs_member_diet_plan_id_date_key" ON "member_diet_daily_logs"("member_diet_plan_id", "date");

-- AddForeignKey
ALTER TABLE "foods" ADD CONSTRAINT "foods_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diet_plans" ADD CONSTRAINT "diet_plans_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diet_plans" ADD CONSTRAINT "diet_plans_trainer_id_fkey" FOREIGN KEY ("trainer_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diet_plan_meals" ADD CONSTRAINT "diet_plan_meals_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diet_plan_meals" ADD CONSTRAINT "diet_plan_meals_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "diet_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diet_plan_meals" ADD CONSTRAINT "diet_plan_meals_food_id_fkey" FOREIGN KEY ("food_id") REFERENCES "foods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_diet_plans" ADD CONSTRAINT "member_diet_plans_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_diet_plans" ADD CONSTRAINT "member_diet_plans_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_diet_plans" ADD CONSTRAINT "member_diet_plans_diet_plan_id_fkey" FOREIGN KEY ("diet_plan_id") REFERENCES "diet_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_diet_plans" ADD CONSTRAINT "member_diet_plans_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_diet_daily_logs" ADD CONSTRAINT "member_diet_daily_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_diet_daily_logs" ADD CONSTRAINT "member_diet_daily_logs_member_diet_plan_id_fkey" FOREIGN KEY ("member_diet_plan_id") REFERENCES "member_diet_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
