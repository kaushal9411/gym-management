-- CreateEnum
CREATE TYPE "tenant_announcement_audience" AS ENUM ('ALL', 'MEMBERS', 'STAFF');

-- CreateEnum
CREATE TYPE "tenant_announcement_status" AS ENUM ('DRAFT', 'SCHEDULED', 'PUBLISHED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "notification_template_type" AS ENUM ('MEMBERSHIP_EXPIRY', 'PAYMENT_SUCCESS', 'PAYMENT_FAILED', 'MEMBERSHIP_RENEWAL', 'NEW_MEMBER_REGISTRATION', 'ATTENDANCE_CONFIRMATION', 'WORKOUT_ASSIGNMENT', 'DIET_ASSIGNMENT', 'WELCOME_MESSAGE', 'BIRTHDAY_WISHES');

-- CreateEnum
CREATE TYPE "tenant_notification_channel" AS ENUM ('IN_APP', 'EMAIL', 'PUSH', 'SMS', 'WHATSAPP');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "tenant_notification_category" ADD VALUE 'MEMBER';
ALTER TYPE "tenant_notification_category" ADD VALUE 'MEMBERSHIP';
ALTER TYPE "tenant_notification_category" ADD VALUE 'PAYMENT';
ALTER TYPE "tenant_notification_category" ADD VALUE 'ATTENDANCE';
ALTER TYPE "tenant_notification_category" ADD VALUE 'WORKOUT';
ALTER TYPE "tenant_notification_category" ADD VALUE 'DIET';
ALTER TYPE "tenant_notification_category" ADD VALUE 'STAFF';

-- CreateTable
CREATE TABLE "tenant_announcements" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "branch_id" UUID,
    "title" VARCHAR(200) NOT NULL,
    "body" TEXT NOT NULL,
    "audience" "tenant_announcement_audience" NOT NULL DEFAULT 'ALL',
    "status" "tenant_announcement_status" NOT NULL DEFAULT 'DRAFT',
    "publish_at" TIMESTAMP(3),
    "published_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_announcements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_templates" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "type" "notification_template_type" NOT NULL,
    "channels" "tenant_notification_channel"[],
    "title_template" VARCHAR(200) NOT NULL,
    "body_template" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tenant_announcements_tenant_id_status_idx" ON "tenant_announcements"("tenant_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "notification_templates_tenant_id_type_key" ON "notification_templates"("tenant_id", "type");

-- AddForeignKey
ALTER TABLE "tenant_announcements" ADD CONSTRAINT "tenant_announcements_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_announcements" ADD CONSTRAINT "tenant_announcements_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_announcements" ADD CONSTRAINT "tenant_announcements_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_templates" ADD CONSTRAINT "notification_templates_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
