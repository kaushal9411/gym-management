-- Tenant control center (super-admin plane). Purely additive.

-- Limit overrides survive plan changes: max* columns hold the effective value, `overrides` records forced keys.
ALTER TABLE "tenant_limits" ADD COLUMN "overrides" JSONB NOT NULL DEFAULT '{}';

-- Module toggles survive plan changes: plan sync skips rows a super admin forced.
ALTER TABLE "tenant_modules" ADD COLUMN "admin_override" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "tenant_admin_notes" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "author_admin_id" UUID,
    "author_name" VARCHAR(120) NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_admin_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_admin_tags" (
    "tenant_id" UUID NOT NULL,
    "tags" TEXT[],
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_admin_tags_pkey" PRIMARY KEY ("tenant_id")
);

-- CreateIndex
CREATE INDEX "tenant_admin_notes_tenant_id_created_at_idx" ON "tenant_admin_notes"("tenant_id", "created_at");

-- AddForeignKey
ALTER TABLE "tenant_admin_notes" ADD CONSTRAINT "tenant_admin_notes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_admin_tags" ADD CONSTRAINT "tenant_admin_tags_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
