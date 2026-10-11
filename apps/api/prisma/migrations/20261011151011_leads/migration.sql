-- CreateEnum
CREATE TYPE "lead_source" AS ENUM ('WALK_IN', 'PHONE_CALL', 'WEBSITE', 'SOCIAL_MEDIA', 'REFERRAL', 'ADVERTISEMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "lead_status" AS ENUM ('NEW', 'CONTACTED', 'VISIT_SCHEDULED', 'TRIAL_DONE', 'NEGOTIATION', 'CONVERTED', 'LOST');

-- CreateEnum
CREATE TYPE "lead_lost_reason" AS ENUM ('PRICE_TOO_HIGH', 'NOT_INTERESTED', 'JOINED_COMPETITOR', 'LOCATION_TOO_FAR', 'TIMING_NOT_RIGHT', 'NO_RESPONSE', 'OTHER');

-- CreateEnum
CREATE TYPE "lead_activity_type" AS ENUM ('NOTE', 'CALL', 'WHATSAPP', 'EMAIL', 'VISIT', 'TRIAL', 'FOLLOW_UP', 'STATUS_CHANGE', 'ASSIGNMENT', 'CREATED', 'CONVERTED');

-- CreateTable
CREATE TABLE "leads" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "branch_id" UUID,
    "name" VARCHAR(160) NOT NULL,
    "phone" VARCHAR(30) NOT NULL,
    "phone_key" VARCHAR(15) NOT NULL,
    "email" VARCHAR(200),
    "gender" "gender",
    "source" "lead_source" NOT NULL DEFAULT 'WALK_IN',
    "source_detail" VARCHAR(200),
    "status" "lead_status" NOT NULL DEFAULT 'NEW',
    "interested_plan_id" UUID,
    "interest" TEXT,
    "assigned_to_user_id" UUID,
    "next_follow_up_at" TIMESTAMP(3),
    "expected_join_date" DATE,
    "lost_reason" "lead_lost_reason",
    "lost_note" TEXT,
    "notes" TEXT,
    "converted_member_id" UUID,
    "converted_at" TIMESTAMP(3),
    "last_activity_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_activities" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "lead_id" UUID NOT NULL,
    "type" "lead_activity_type" NOT NULL,
    "note" TEXT,
    "outcome" VARCHAR(120),
    "from_status" "lead_status",
    "to_status" "lead_status",
    "scheduled_for" TIMESTAMP(3),
    "created_by_user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_activities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "leads_converted_member_id_key" ON "leads"("converted_member_id");

-- CreateIndex
CREATE INDEX "leads_tenant_id_status_idx" ON "leads"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "leads_tenant_id_created_at_idx" ON "leads"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "leads_tenant_id_assigned_to_user_id_idx" ON "leads"("tenant_id", "assigned_to_user_id");

-- CreateIndex
CREATE INDEX "leads_tenant_id_next_follow_up_at_idx" ON "leads"("tenant_id", "next_follow_up_at");

-- CreateIndex
CREATE INDEX "leads_tenant_id_phone_key_idx" ON "leads"("tenant_id", "phone_key");

-- CreateIndex
CREATE INDEX "leads_tenant_id_branch_id_created_at_idx" ON "leads"("tenant_id", "branch_id", "created_at");

-- CreateIndex
CREATE INDEX "lead_activities_tenant_id_lead_id_created_at_idx" ON "lead_activities"("tenant_id", "lead_id", "created_at");

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_interested_plan_id_fkey" FOREIGN KEY ("interested_plan_id") REFERENCES "membership_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_assigned_to_user_id_fkey" FOREIGN KEY ("assigned_to_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_converted_member_id_fkey" FOREIGN KEY ("converted_member_id") REFERENCES "members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_activities" ADD CONSTRAINT "lead_activities_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_activities" ADD CONSTRAINT "lead_activities_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_activities" ADD CONSTRAINT "lead_activities_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
