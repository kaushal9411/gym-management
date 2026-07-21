-- CreateEnum
CREATE TYPE "gender" AS ENUM ('MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY');

-- CreateEnum
CREATE TYPE "employment_type" AS ENUM ('FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN');

-- CreateEnum
CREATE TYPE "salary_type" AS ENUM ('MONTHLY', 'HOURLY', 'DAILY', 'PER_SESSION');

-- CreateEnum
CREATE TYPE "work_status" AS ENUM ('WORKING', 'ON_LEAVE', 'NOTICE_PERIOD', 'TERMINATED');

-- CreateTable
CREATE TABLE "staff_profiles" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "employee_id" VARCHAR(40) NOT NULL,
    "first_name" VARCHAR(80) NOT NULL,
    "last_name" VARCHAR(80) NOT NULL,
    "gender" "gender",
    "date_of_birth" DATE,
    "joining_date" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "address_line" VARCHAR(200),
    "city" VARCHAR(100),
    "state" VARCHAR(100),
    "country" VARCHAR(100),
    "postal_code" VARCHAR(20),
    "notes" TEXT,
    "employment_type" "employment_type" NOT NULL DEFAULT 'FULL_TIME',
    "salary_type" "salary_type" NOT NULL DEFAULT 'MONTHLY',
    "salary_amount" DECIMAL(12,2),
    "shift" VARCHAR(60),
    "weekly_off" VARCHAR(60),
    "work_status" "work_status" NOT NULL DEFAULT 'WORKING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "staff_profiles_user_id_key" ON "staff_profiles"("user_id");

-- CreateIndex
CREATE INDEX "staff_profiles_tenant_id_idx" ON "staff_profiles"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "staff_profiles_tenant_id_employee_id_key" ON "staff_profiles"("tenant_id", "employee_id");

-- AddForeignKey
ALTER TABLE "staff_profiles" ADD CONSTRAINT "staff_profiles_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_profiles" ADD CONSTRAINT "staff_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
