-- CreateEnum
CREATE TYPE "payment_status" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED');

-- CreateEnum
CREATE TYPE "payment_gateway_provider" AS ENUM ('STRIPE', 'RAZORPAY', 'PAYPAL');

-- CreateEnum
CREATE TYPE "invoice_status" AS ENUM ('DRAFT', 'OPEN', 'PAID', 'VOID', 'UNCOLLECTIBLE');

-- CreateEnum
CREATE TYPE "coupon_type" AS ENUM ('PERCENTAGE', 'FIXED_AMOUNT', 'TRIAL_EXTENSION');

-- CreateEnum
CREATE TYPE "coupon_scope" AS ENUM ('ONE_TIME', 'RECURRING', 'REFERRAL');

-- CreateEnum
CREATE TYPE "subscription_history_action" AS ENUM ('CREATED', 'UPGRADED', 'DOWNGRADED', 'RENEWED', 'CANCELLED', 'REACTIVATED', 'SUSPENDED', 'EXPIRED', 'TRIAL_STARTED', 'TRIAL_ENDED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "subscription_status" ADD VALUE 'GRACE';
ALTER TYPE "subscription_status" ADD VALUE 'SUSPENDED';
ALTER TYPE "subscription_status" ADD VALUE 'EXPIRED';

-- AlterTable
ALTER TABLE "subscription_plans" ADD COLUMN     "max_receptionists" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "max_staff" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "subscriptions" ADD COLUMN     "cancel_reason" TEXT,
ADD COLUMN     "cancelled_at" TIMESTAMP(3),
ADD COLUMN     "coupon_id" UUID,
ADD COLUMN     "grace_ends_at" TIMESTAMP(3),
ADD COLUMN     "suspended_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "tenant_limits" ADD COLUMN     "max_receptionists" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "max_staff" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "subscription_history" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "subscription_id" UUID NOT NULL,
    "from_plan_id" UUID,
    "to_plan_id" UUID,
    "from_status" "subscription_status",
    "to_status" "subscription_status" NOT NULL,
    "action" "subscription_history_action" NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscription_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_addresses" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "legal_name" VARCHAR(160),
    "line1" VARCHAR(200) NOT NULL,
    "line2" VARCHAR(200),
    "city" VARCHAR(100) NOT NULL,
    "state" VARCHAR(100) NOT NULL,
    "postal_code" VARCHAR(20) NOT NULL,
    "country" VARCHAR(2) NOT NULL,
    "tax_id" VARCHAR(40),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "billing_addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_rules" (
    "id" UUID NOT NULL,
    "country_code" VARCHAR(2) NOT NULL,
    "state_code" VARCHAR(10),
    "label" VARCHAR(80) NOT NULL,
    "rate_percent" DECIMAL(5,2) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tax_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coupons" (
    "id" UUID NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "type" "coupon_type" NOT NULL,
    "scope" "coupon_scope" NOT NULL DEFAULT 'ONE_TIME',
    "percent_off" DECIMAL(5,2),
    "amount_off" DECIMAL(10,2),
    "currency" CHAR(3),
    "trial_extension_days" INTEGER,
    "max_redemptions" INTEGER,
    "max_redemptions_per_tenant" INTEGER NOT NULL DEFAULT 1,
    "times_redeemed" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coupons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coupon_redemptions" (
    "id" UUID NOT NULL,
    "coupon_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "redeemed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coupon_redemptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_gateways" (
    "id" UUID NOT NULL,
    "provider" "payment_gateway_provider" NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_gateways_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_methods" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "provider" "payment_gateway_provider" NOT NULL,
    "gateway_customer_id" TEXT,
    "gateway_method_id" TEXT NOT NULL,
    "brand" VARCHAR(30),
    "last4" VARCHAR(4),
    "expiry_month" INTEGER,
    "expiry_year" INTEGER,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_methods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "subscription_id" UUID,
    "invoice_id" UUID,
    "provider" "payment_gateway_provider" NOT NULL,
    "status" "payment_status" NOT NULL DEFAULT 'PENDING',
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "gateway_reference" TEXT,
    "failure_reason" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_transactions" (
    "id" UUID NOT NULL,
    "payment_id" UUID NOT NULL,
    "provider" "payment_gateway_provider" NOT NULL,
    "event_type" VARCHAR(60) NOT NULL,
    "raw_payload" JSONB NOT NULL,
    "signature_valid" BOOLEAN NOT NULL,
    "processed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "subscription_id" UUID,
    "coupon_id" UUID,
    "invoice_number" VARCHAR(40) NOT NULL,
    "status" "invoice_status" NOT NULL DEFAULT 'OPEN',
    "subtotal" DECIMAL(10,2) NOT NULL,
    "tax_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "discount_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(10,2) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "due_date" TIMESTAMP(3),
    "paid_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_items" (
    "id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "description" VARCHAR(200) NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unit_price" DECIMAL(10,2) NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoice_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "subscription_history_tenant_id_created_at_idx" ON "subscription_history"("tenant_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "billing_addresses_tenant_id_key" ON "billing_addresses"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "tax_rules_country_code_state_code_key" ON "tax_rules"("country_code", "state_code");

-- CreateIndex
CREATE UNIQUE INDEX "coupons_code_key" ON "coupons"("code");

-- CreateIndex
CREATE INDEX "coupon_redemptions_tenant_id_idx" ON "coupon_redemptions"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_gateways_provider_key" ON "payment_gateways"("provider");

-- CreateIndex
CREATE INDEX "payment_methods_tenant_id_idx" ON "payment_methods"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_invoice_id_key" ON "payments"("invoice_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_idempotency_key_key" ON "payments"("idempotency_key");

-- CreateIndex
CREATE INDEX "payments_tenant_id_created_at_idx" ON "payments"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "payment_transactions_payment_id_idx" ON "payment_transactions"("payment_id");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_invoice_number_key" ON "invoices"("invoice_number");

-- CreateIndex
CREATE INDEX "invoices_tenant_id_created_at_idx" ON "invoices"("tenant_id", "created_at");

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "coupons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_history" ADD CONSTRAINT "subscription_history_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_history" ADD CONSTRAINT "subscription_history_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_addresses" ADD CONSTRAINT "billing_addresses_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "coupons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_methods" ADD CONSTRAINT "payment_methods_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "coupons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
