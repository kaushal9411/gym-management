-- CreateEnum
CREATE TYPE "admin_user_status" AS ENUM ('ACTIVE', 'SUSPENDED', 'DEACTIVATED');

-- CreateEnum
CREATE TYPE "ticket_status" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "ticket_priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "announcement_audience" AS ENUM ('ALL', 'TRIAL', 'ACTIVE', 'SPECIFIC');

-- CreateEnum
CREATE TYPE "notification_channel" AS ENUM ('EMAIL', 'PUSH', 'IN_APP');

-- CreateEnum
CREATE TYPE "cms_page_type" AS ENUM ('LANDING', 'BLOG', 'FAQ', 'TESTIMONIAL', 'TERMS', 'PRIVACY', 'COOKIE');

-- CreateTable
CREATE TABLE "admin_roles" (
    "id" UUID NOT NULL,
    "name" VARCHAR(60) NOT NULL,
    "description" TEXT,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_permissions" (
    "id" UUID NOT NULL,
    "key" VARCHAR(80) NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_role_permissions" (
    "role_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,

    CONSTRAINT "admin_role_permissions_pkey" PRIMARY KEY ("role_id","permission_id")
);

-- CreateTable
CREATE TABLE "admin_users" (
    "id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "status" "admin_user_status" NOT NULL DEFAULT 'ACTIVE',
    "mfa_enabled" BOOLEAN NOT NULL DEFAULT false,
    "mfa_secret" TEXT,
    "failed_login_attempts" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMP(3),
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "admin_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_refresh_tokens" (
    "id" UUID NOT NULL,
    "admin_user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "family" UUID NOT NULL,
    "user_agent" TEXT,
    "ip_address" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "replaced_by_token_hash" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_audit_logs" (
    "id" UUID NOT NULL,
    "admin_user_id" UUID,
    "actor_role" VARCHAR(60),
    "action" VARCHAR(80) NOT NULL,
    "entity_type" VARCHAR(60),
    "entity_id" TEXT,
    "before" JSONB,
    "after" JSONB,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_settings" (
    "id" UUID NOT NULL,
    "key" VARCHAR(100) NOT NULL,
    "category" VARCHAR(60) NOT NULL,
    "value" JSONB NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feature_flags" (
    "id" UUID NOT NULL,
    "key" VARCHAR(60) NOT NULL,
    "label" VARCHAR(120) NOT NULL,
    "category" VARCHAR(60),
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feature_flags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cms_pages" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(160) NOT NULL,
    "type" "cms_page_type" NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "content" JSONB NOT NULL,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cms_pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_tickets" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "subject" VARCHAR(200) NOT NULL,
    "description" TEXT NOT NULL,
    "status" "ticket_status" NOT NULL DEFAULT 'OPEN',
    "priority" "ticket_priority" NOT NULL DEFAULT 'MEDIUM',
    "assigned_admin_id" UUID,
    "created_by_email" VARCHAR(255) NOT NULL,
    "created_by_name" VARCHAR(120),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "closed_at" TIMESTAMP(3),

    CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_ticket_notes" (
    "id" UUID NOT NULL,
    "ticket_id" UUID NOT NULL,
    "author_admin_id" UUID NOT NULL,
    "note" TEXT NOT NULL,
    "is_internal" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_ticket_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "announcements" (
    "id" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "body" TEXT NOT NULL,
    "audience" "announcement_audience" NOT NULL DEFAULT 'ALL',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "published_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "announcements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "body" TEXT NOT NULL,
    "channel" "notification_channel" NOT NULL DEFAULT 'EMAIL',
    "audience" "announcement_audience" NOT NULL DEFAULT 'ALL',
    "scheduled_at" TIMESTAMP(3),
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "countries" (
    "id" UUID NOT NULL,
    "code" VARCHAR(2) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "countries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "currencies" (
    "id" UUID NOT NULL,
    "code" VARCHAR(3) NOT NULL,
    "name" VARCHAR(60) NOT NULL,
    "symbol" VARCHAR(8) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "currencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_templates" (
    "id" UUID NOT NULL,
    "key" VARCHAR(80) NOT NULL,
    "subject" VARCHAR(200) NOT NULL,
    "body_html" TEXT NOT NULL,
    "variables" JSONB NOT NULL DEFAULT '[]',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sms_templates" (
    "id" UUID NOT NULL,
    "key" VARCHAR(80) NOT NULL,
    "body" TEXT NOT NULL,
    "variables" JSONB NOT NULL DEFAULT '[]',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sms_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "admin_roles_name_key" ON "admin_roles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "admin_permissions_key_key" ON "admin_permissions"("key");

-- CreateIndex
CREATE UNIQUE INDEX "admin_users_email_key" ON "admin_users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "admin_refresh_tokens_token_hash_key" ON "admin_refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "admin_refresh_tokens_admin_user_id_idx" ON "admin_refresh_tokens"("admin_user_id");

-- CreateIndex
CREATE INDEX "admin_refresh_tokens_family_idx" ON "admin_refresh_tokens"("family");

-- CreateIndex
CREATE INDEX "admin_audit_logs_created_at_idx" ON "admin_audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "admin_audit_logs_action_idx" ON "admin_audit_logs"("action");

-- CreateIndex
CREATE UNIQUE INDEX "system_settings_key_key" ON "system_settings"("key");

-- CreateIndex
CREATE UNIQUE INDEX "feature_flags_key_key" ON "feature_flags"("key");

-- CreateIndex
CREATE UNIQUE INDEX "cms_pages_slug_key" ON "cms_pages"("slug");

-- CreateIndex
CREATE INDEX "support_tickets_status_priority_idx" ON "support_tickets"("status", "priority");

-- CreateIndex
CREATE INDEX "support_tickets_tenant_id_idx" ON "support_tickets"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "countries_code_key" ON "countries"("code");

-- CreateIndex
CREATE UNIQUE INDEX "currencies_code_key" ON "currencies"("code");

-- CreateIndex
CREATE UNIQUE INDEX "email_templates_key_key" ON "email_templates"("key");

-- CreateIndex
CREATE UNIQUE INDEX "sms_templates_key_key" ON "sms_templates"("key");

-- AddForeignKey
ALTER TABLE "admin_role_permissions" ADD CONSTRAINT "admin_role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "admin_roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_role_permissions" ADD CONSTRAINT "admin_role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "admin_permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_users" ADD CONSTRAINT "admin_users_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "admin_roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_refresh_tokens" ADD CONSTRAINT "admin_refresh_tokens_admin_user_id_fkey" FOREIGN KEY ("admin_user_id") REFERENCES "admin_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_audit_logs" ADD CONSTRAINT "admin_audit_logs_admin_user_id_fkey" FOREIGN KEY ("admin_user_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_assigned_admin_id_fkey" FOREIGN KEY ("assigned_admin_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_ticket_notes" ADD CONSTRAINT "support_ticket_notes_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "support_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_ticket_notes" ADD CONSTRAINT "support_ticket_notes_author_admin_id_fkey" FOREIGN KEY ("author_admin_id") REFERENCES "admin_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
