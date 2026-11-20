-- Public website contact form -> super-admin "Leads".
--
-- Platform-plane table (the SaaS operator's own sales pipeline), so no tenant_id and
-- no RLS — same as cms_pages. It is only ever read/written through the public
-- `POST /public/contact` and the super-admin `/admin/leads` API.

CREATE TYPE "platform_lead_status" AS ENUM ('NEW', 'CONTACTED', 'QUALIFIED', 'WON', 'LOST');
CREATE TYPE "platform_lead_topic" AS ENUM ('SALES', 'BILLING', 'DEMO', 'GENERAL');

CREATE TABLE "platform_leads" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(20),
    "gym_name" VARCHAR(120),
    "gym_slug" VARCHAR(60),
    "gym_size" VARCHAR(30),
    "topic" "platform_lead_topic" NOT NULL DEFAULT 'SALES',
    "message" TEXT NOT NULL,
    "source" VARCHAR(30) NOT NULL DEFAULT 'HOME_PAGE',
    "status" "platform_lead_status" NOT NULL DEFAULT 'NEW',
    "notes" TEXT,
    "contacted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_leads_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "platform_leads_status_created_at_idx" ON "platform_leads"("status", "created_at");
CREATE INDEX "platform_leads_email_idx" ON "platform_leads"("email");

-- ── New super-admin permission `leads:manage` ─────────────────────────────
-- Idempotent. SUPER_ADMIN and SUPPORT_ADMIN get it (the seed does the same for fresh
-- databases). If the admin roles do not exist yet this inserts the permission only.
INSERT INTO "admin_permissions" ("id", "key", "description") VALUES
  (gen_random_uuid(), 'leads:manage', 'View and work the sales leads submitted through the public website contact form')
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "admin_role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id"
FROM "admin_roles" r
JOIN "admin_permissions" p ON p."key" = 'leads:manage'
WHERE r."name" IN ('SUPER_ADMIN', 'SUPPORT_ADMIN')
ON CONFLICT DO NOTHING;
