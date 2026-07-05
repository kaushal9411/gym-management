-- CreateEnum
CREATE TYPE "tenant_notification_category" AS ENUM ('ANNOUNCEMENT', 'SYSTEM', 'SUBSCRIPTION', 'GENERAL');

-- AlterTable
ALTER TABLE "tenant_branding" ADD COLUMN     "secondary_color" TEXT;

-- CreateTable
CREATE TABLE "tenant_notifications" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "category" "tenant_notification_category" NOT NULL DEFAULT 'GENERAL',
    "title" VARCHAR(200) NOT NULL,
    "body" TEXT NOT NULL,
    "source_notification_id" UUID,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tenant_notifications_tenant_id_created_at_idx" ON "tenant_notifications"("tenant_id", "created_at");

-- AddForeignKey
ALTER TABLE "tenant_notifications" ADD CONSTRAINT "tenant_notifications_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
