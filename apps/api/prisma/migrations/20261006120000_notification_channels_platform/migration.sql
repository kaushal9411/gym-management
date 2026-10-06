-- CreateEnum
CREATE TYPE "notification_delivery_status" AS ENUM ('SENT', 'FAILED', 'SKIPPED_DISABLED', 'SKIPPED_QUOTA');

-- AlterTable
ALTER TABLE "tenant_settings" ADD COLUMN     "whatsapp_notifications_enabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "platform_notification_credentials" (
    "id" UUID NOT NULL,
    "smtp_host" TEXT,
    "smtp_port" INTEGER,
    "smtp_user" TEXT,
    "smtp_password_encrypted" TEXT,
    "smtp_from_name" TEXT,
    "smtp_from_address" TEXT,
    "twilio_account_sid" TEXT,
    "twilio_auth_token_encrypted" TEXT,
    "twilio_sms_from_number" TEXT,
    "twilio_whatsapp_from_number" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" UUID,

    CONSTRAINT "platform_notification_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_notification_channel_limits" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "email_enabled" BOOLEAN NOT NULL DEFAULT true,
    "email_monthly_limit" INTEGER,
    "sms_enabled" BOOLEAN NOT NULL DEFAULT false,
    "sms_monthly_limit" INTEGER,
    "whatsapp_enabled" BOOLEAN NOT NULL DEFAULT false,
    "whatsapp_monthly_limit" INTEGER,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_notification_channel_limits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_notification_usage" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "channel" "tenant_notification_channel" NOT NULL,
    "period_key" VARCHAR(7) NOT NULL,
    "sent_count" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_notification_usage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_delivery_logs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "channel" "tenant_notification_channel" NOT NULL,
    "recipient" VARCHAR(255) NOT NULL,
    "subject" VARCHAR(200),
    "content" TEXT NOT NULL,
    "status" "notification_delivery_status" NOT NULL,
    "provider_ref" TEXT,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_delivery_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenant_notification_channel_limits_tenant_id_key" ON "tenant_notification_channel_limits"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_notification_usage_tenant_id_channel_period_key_key" ON "tenant_notification_usage"("tenant_id", "channel", "period_key");

-- CreateIndex
CREATE INDEX "notification_delivery_logs_tenant_id_channel_created_at_idx" ON "notification_delivery_logs"("tenant_id", "channel", "created_at");

-- AddForeignKey
ALTER TABLE "tenant_notification_channel_limits" ADD CONSTRAINT "tenant_notification_channel_limits_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_notification_usage" ADD CONSTRAINT "tenant_notification_usage_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_delivery_logs" ADD CONSTRAINT "notification_delivery_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

