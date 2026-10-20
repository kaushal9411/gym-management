-- Communications: notification campaigns, recipients, automation rules, dispatch ledger,
-- member channel preferences. DDL generated with `prisma migrate diff`; RLS + the
-- `notifications:send` permission backfill are hand-written.

-- CreateEnum
CREATE TYPE "campaign_audience_mode" AS ENUM ('FILTERS', 'PICKED');

-- CreateEnum
CREATE TYPE "campaign_status" AS ENUM ('DRAFT', 'SCHEDULED', 'SENDING', 'SENT', 'PARTIAL', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "campaign_recipient_status" AS ENUM ('QUEUED', 'SENT', 'FAILED', 'SKIPPED_OPTED_OUT', 'SKIPPED_NO_CONTACT', 'SKIPPED_QUOTA', 'SKIPPED_DISABLED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "automation_rule_key" AS ENUM ('MEMBERSHIP_EXPIRING', 'MEMBERSHIP_EXPIRED', 'PAYMENT_OVERDUE', 'INVOICE_DUE_SOON', 'PAYMENT_FAILED', 'CLASS_REMINDER', 'CLASS_SCHEDULED_OR_CHANGED', 'BIRTHDAY', 'WE_MISS_YOU');

-- CreateTable
CREATE TABLE "notification_campaigns" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "body" TEXT NOT NULL,
    "channels" "tenant_notification_channel"[],
    "audience_mode" "campaign_audience_mode" NOT NULL,
    "audience_filter" JSONB NOT NULL DEFAULT '{}',
    "picked_member_ids" JSONB,
    "scope_branch_ids" JSONB,
    "template_key" VARCHAR(40),
    "status" "campaign_status" NOT NULL DEFAULT 'DRAFT',
    "scheduled_at" TIMESTAMP(3),
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    "hold_quiet_hours" BOOLEAN NOT NULL DEFAULT true,
    "recipient_count" INTEGER NOT NULL DEFAULT 0,
    "message_count" INTEGER NOT NULL DEFAULT 0,
    "sent_count" INTEGER NOT NULL DEFAULT 0,
    "failed_count" INTEGER NOT NULL DEFAULT 0,
    "skipped_count" INTEGER NOT NULL DEFAULT 0,
    "cancelled_count" INTEGER NOT NULL DEFAULT 0,
    "failure_reason" TEXT,
    "idempotency_key" VARCHAR(100),
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_campaign_recipients" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "campaign_id" UUID NOT NULL,
    "member_id" UUID NOT NULL,
    "channel" "tenant_notification_channel" NOT NULL,
    "status" "campaign_recipient_status" NOT NULL DEFAULT 'QUEUED',
    "error" TEXT,
    "delivery_log_id" UUID,
    "sent_at" TIMESTAMP(3),
    "dispatched_at" TIMESTAMP(3),
    "deliver_after" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_campaign_recipients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_automation_rules" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "key" "automation_rule_key" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "offsets" JSONB NOT NULL DEFAULT '[]',
    "channels" "tenant_notification_channel"[],
    "title_template" VARCHAR(200),
    "body_template" TEXT,
    "updated_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_automation_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "automation_dispatches" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "rule_key" "automation_rule_key" NOT NULL,
    "member_id" UUID NOT NULL,
    "subject_id" VARCHAR(64) NOT NULL,
    "offset_key" VARCHAR(40) NOT NULL,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "automation_dispatches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "member_channel_preferences" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "member_id" UUID NOT NULL,
    "channel" "tenant_notification_channel" NOT NULL,
    "promotional_opt_out" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "member_channel_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notification_campaigns_tenant_id_status_created_at_idx" ON "notification_campaigns"("tenant_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "notification_campaigns_tenant_id_created_at_idx" ON "notification_campaigns"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "notification_campaigns_status_scheduled_at_idx" ON "notification_campaigns"("status", "scheduled_at");

-- CreateIndex
CREATE UNIQUE INDEX "notification_campaigns_tenant_id_idempotency_key_key" ON "notification_campaigns"("tenant_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "notification_campaign_recipients_campaign_id_status_idx" ON "notification_campaign_recipients"("campaign_id", "status");

-- CreateIndex
CREATE INDEX "notification_campaign_recipients_tenant_id_member_id_idx" ON "notification_campaign_recipients"("tenant_id", "member_id");

-- CreateIndex
CREATE INDEX "notification_campaign_recipients_status_dispatched_at_idx" ON "notification_campaign_recipients"("status", "dispatched_at");

-- CreateIndex
CREATE UNIQUE INDEX "notification_campaign_recipients_campaign_id_member_id_chan_key" ON "notification_campaign_recipients"("campaign_id", "member_id", "channel");

-- CreateIndex
CREATE UNIQUE INDEX "notification_automation_rules_tenant_id_key_key" ON "notification_automation_rules"("tenant_id", "key");

-- CreateIndex
CREATE INDEX "automation_dispatches_tenant_id_rule_key_sent_at_idx" ON "automation_dispatches"("tenant_id", "rule_key", "sent_at");

-- CreateIndex
CREATE UNIQUE INDEX "automation_dispatches_tenant_id_rule_key_member_id_subject__key" ON "automation_dispatches"("tenant_id", "rule_key", "member_id", "subject_id", "offset_key");

-- CreateIndex
CREATE INDEX "member_channel_preferences_tenant_id_channel_promotional_op_idx" ON "member_channel_preferences"("tenant_id", "channel", "promotional_opt_out");

-- CreateIndex
CREATE UNIQUE INDEX "member_channel_preferences_member_id_channel_key" ON "member_channel_preferences"("member_id", "channel");

-- AddForeignKey
ALTER TABLE "notification_campaigns" ADD CONSTRAINT "notification_campaigns_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_campaigns" ADD CONSTRAINT "notification_campaigns_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_campaign_recipients" ADD CONSTRAINT "notification_campaign_recipients_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_campaign_recipients" ADD CONSTRAINT "notification_campaign_recipients_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "notification_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_campaign_recipients" ADD CONSTRAINT "notification_campaign_recipients_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_automation_rules" ADD CONSTRAINT "notification_automation_rules_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_dispatches" ADD CONSTRAINT "automation_dispatches_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_dispatches" ADD CONSTRAINT "automation_dispatches_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_channel_preferences" ADD CONSTRAINT "member_channel_preferences_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_channel_preferences" ADD CONSTRAINT "member_channel_preferences_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ──────────────────────────────────────────────────────────────────────────
-- Row-Level Security (forced; same policy shape as every tenant-scoped table)
-- ──────────────────────────────────────────────────────────────────────────
ALTER TABLE "notification_campaigns" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notification_campaigns" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "notification_campaigns"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

ALTER TABLE "notification_campaign_recipients" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notification_campaign_recipients" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "notification_campaign_recipients"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

ALTER TABLE "notification_automation_rules" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notification_automation_rules" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "notification_automation_rules"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

ALTER TABLE "automation_dispatches" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "automation_dispatches" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "automation_dispatches"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

ALTER TABLE "member_channel_preferences" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "member_channel_preferences" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "member_channel_preferences"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- ──────────────────────────────────────────────────────────────────────────
-- Permission `notifications:send` (tenant plane) + default role grants.
-- Mirrors prisma/seed.ts PERMISSIONS / ROLE_PERMISSIONS: granted to the same
-- system roles that already hold `notifications:manage` (OWNER, MANAGER).
-- System roles are global (tenant_id NULL), so this covers every tenant.
-- Idempotent — safe to re-run.
-- ──────────────────────────────────────────────────────────────────────────
INSERT INTO "permissions" ("id", "key", "description") VALUES
  (gen_random_uuid(), 'notifications:send', 'Send bulk messages (campaigns) to members and run test sends')
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id"
FROM "roles" r
JOIN "permissions" p ON p."key" = 'notifications:send'
WHERE r."tenant_id" IS NULL AND r."is_system" = true AND r."name" IN ('OWNER', 'MANAGER')
ON CONFLICT DO NOTHING;

-- Invalidate cached effective-permission sets: `perm:{userId}:{permVer}` is keyed by
-- the persisted version, so bumping it makes the next request recompute and pick up
-- the new grant without waiting for the 30-minute cache TTL.
UPDATE "users" SET "permission_version" = "permission_version" + 1
WHERE "id" IN (
  SELECT ur."user_id" FROM "user_roles" ur
  JOIN "roles" r ON r."id" = ur."role_id"
  WHERE r."tenant_id" IS NULL AND r."is_system" = true AND r."name" IN ('OWNER', 'MANAGER')
);
