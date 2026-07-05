-- CreateEnum
CREATE TYPE "subscription_status" AS ENUM ('TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED');

-- CreateEnum
CREATE TYPE "billing_cycle" AS ENUM ('MONTHLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "domain_type" AS ENUM ('SUBDOMAIN', 'CUSTOM');

-- CreateTable
CREATE TABLE "subscription_plans" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(40) NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "description" TEXT,
    "price_monthly" DECIMAL(10,2) NOT NULL,
    "price_yearly" DECIMAL(10,2) NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'USD',
    "trial_days" INTEGER NOT NULL DEFAULT 14,
    "max_branches" INTEGER NOT NULL,
    "max_managers" INTEGER NOT NULL,
    "max_trainers" INTEGER NOT NULL,
    "max_members" INTEGER NOT NULL,
    "max_storage_mb" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscription_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_features" (
    "id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "key" VARCHAR(60) NOT NULL,
    "label" VARCHAR(120) NOT NULL,
    "included" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscription_features_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "status" "subscription_status" NOT NULL DEFAULT 'TRIALING',
    "billing_cycle" "billing_cycle" NOT NULL DEFAULT 'MONTHLY',
    "trial_ends_at" TIMESTAMP(3),
    "current_period_start" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "current_period_end" TIMESTAMP(3),
    "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false,
    "gateway_provider" VARCHAR(20),
    "gateway_customer_id" TEXT,
    "gateway_subscription_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_domains" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "domain" VARCHAR(255) NOT NULL,
    "type" "domain_type" NOT NULL DEFAULT 'SUBDOMAIN',
    "is_primary" BOOLEAN NOT NULL DEFAULT true,
    "is_verified" BOOLEAN NOT NULL DEFAULT true,
    "dns_verified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_domains_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_branding" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "logo_url" TEXT,
    "favicon_url" TEXT,
    "primary_color" TEXT NOT NULL DEFAULT 'oklch(0.51 0.23 277)',
    "primary_foreground" TEXT NOT NULL DEFAULT 'oklch(0.985 0 0)',
    "welcome_message" TEXT,
    "custom_css" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_branding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "branches" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT true,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "timezone" VARCHAR(64) NOT NULL DEFAULT 'UTC',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "branches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_modules" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "key" VARCHAR(60) NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_modules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_limits" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "max_branches" INTEGER NOT NULL,
    "max_managers" INTEGER NOT NULL,
    "max_trainers" INTEGER NOT NULL,
    "max_members" INTEGER NOT NULL,
    "max_storage_mb" INTEGER NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_limits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_usage" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "metric" VARCHAR(40) NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_usage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "subscription_plans_slug_key" ON "subscription_plans"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_features_plan_id_key_key" ON "subscription_features"("plan_id", "key");

-- CreateIndex
CREATE INDEX "subscriptions_tenant_id_idx" ON "subscriptions"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_domains_domain_key" ON "tenant_domains"("domain");

-- CreateIndex
CREATE INDEX "tenant_domains_tenant_id_idx" ON "tenant_domains"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_branding_tenant_id_key" ON "tenant_branding"("tenant_id");

-- CreateIndex
CREATE INDEX "branches_tenant_id_idx" ON "branches"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_modules_tenant_id_key_key" ON "tenant_modules"("tenant_id", "key");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_limits_tenant_id_key" ON "tenant_limits"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_usage_tenant_id_metric_key" ON "tenant_usage"("tenant_id", "metric");

-- AddForeignKey
ALTER TABLE "subscription_features" ADD CONSTRAINT "subscription_features_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "subscription_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "subscription_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_domains" ADD CONSTRAINT "tenant_domains_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_branding" ADD CONSTRAINT "tenant_branding_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branches" ADD CONSTRAINT "branches_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_modules" ADD CONSTRAINT "tenant_modules_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_limits" ADD CONSTRAINT "tenant_limits_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_usage" ADD CONSTRAINT "tenant_usage_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
