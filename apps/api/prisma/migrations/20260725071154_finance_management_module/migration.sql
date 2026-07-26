-- CreateEnum
CREATE TYPE "member_payment_method" AS ENUM ('CASH', 'UPI', 'CREDIT_CARD', 'DEBIT_CARD', 'BANK_TRANSFER', 'CHEQUE', 'ONLINE_GATEWAY');

-- CreateEnum
CREATE TYPE "member_payment_status" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'CANCELLED', 'REFUNDED', 'PARTIALLY_REFUNDED');

-- CreateEnum
CREATE TYPE "member_invoice_status" AS ENUM ('UNPAID', 'PAID', 'PARTIALLY_PAID', 'OVERDUE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "income_category" AS ENUM ('MEMBERSHIP_FEE', 'PERSONAL_TRAINING', 'PRODUCT_SALES', 'OTHER');

-- CreateEnum
CREATE TYPE "expense_category" AS ENUM ('RENT', 'SALARY', 'UTILITIES', 'EQUIPMENT', 'MAINTENANCE', 'MARKETING', 'OFFICE_SUPPLIES', 'OTHER');

-- CreateTable
CREATE TABLE "member_invoices" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "invoice_number" VARCHAR(30) NOT NULL,
    "member_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "invoice_date" DATE NOT NULL,
    "due_date" DATE NOT NULL,
    "subtotal" DECIMAL(10,2) NOT NULL,
    "tax_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "discount_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "total_amount" DECIMAL(10,2) NOT NULL,
    "status" "member_invoice_status" NOT NULL DEFAULT 'UNPAID',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "member_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "member_invoice_items" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "description" VARCHAR(200) NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unit_price" DECIMAL(10,2) NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "member_invoice_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "member_payments" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "payment_number" VARCHAR(30) NOT NULL,
    "member_id" UUID NOT NULL,
    "membership_id" UUID,
    "invoice_id" UUID,
    "branch_id" UUID NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "discount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "tax" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "final_amount" DECIMAL(10,2) NOT NULL,
    "method" "member_payment_method" NOT NULL,
    "payment_date" DATE NOT NULL,
    "transaction_reference" VARCHAR(120),
    "status" "member_payment_status" NOT NULL DEFAULT 'SUCCESS',
    "notes" TEXT,
    "recorded_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "member_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "member_payment_refunds" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "payment_id" UUID NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "reason" TEXT,
    "refunded_by" UUID,
    "refunded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "member_payment_refunds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "income_entries" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "category" "income_category" NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "income_date" DATE NOT NULL,
    "branch_id" UUID,
    "description" TEXT,
    "source_payment_id" UUID,
    "recorded_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "income_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expenses" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "category" "expense_category" NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "expense_date" DATE NOT NULL,
    "branch_id" UUID,
    "description" TEXT,
    "receipt_file_name" VARCHAR(200),
    "receipt_data_url" TEXT,
    "recorded_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "member_invoices_tenant_id_member_id_idx" ON "member_invoices"("tenant_id", "member_id");

-- CreateIndex
CREATE INDEX "member_invoices_tenant_id_status_idx" ON "member_invoices"("tenant_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "member_invoices_tenant_id_invoice_number_key" ON "member_invoices"("tenant_id", "invoice_number");

-- CreateIndex
CREATE INDEX "member_invoice_items_tenant_id_invoice_id_idx" ON "member_invoice_items"("tenant_id", "invoice_id");

-- CreateIndex
CREATE INDEX "member_payments_tenant_id_member_id_idx" ON "member_payments"("tenant_id", "member_id");

-- CreateIndex
CREATE INDEX "member_payments_tenant_id_status_idx" ON "member_payments"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "member_payments_tenant_id_invoice_id_idx" ON "member_payments"("tenant_id", "invoice_id");

-- CreateIndex
CREATE UNIQUE INDEX "member_payments_tenant_id_payment_number_key" ON "member_payments"("tenant_id", "payment_number");

-- CreateIndex
CREATE INDEX "member_payment_refunds_tenant_id_payment_id_idx" ON "member_payment_refunds"("tenant_id", "payment_id");

-- CreateIndex
CREATE UNIQUE INDEX "income_entries_source_payment_id_key" ON "income_entries"("source_payment_id");

-- CreateIndex
CREATE INDEX "income_entries_tenant_id_category_idx" ON "income_entries"("tenant_id", "category");

-- CreateIndex
CREATE INDEX "income_entries_tenant_id_income_date_idx" ON "income_entries"("tenant_id", "income_date");

-- CreateIndex
CREATE INDEX "expenses_tenant_id_category_idx" ON "expenses"("tenant_id", "category");

-- CreateIndex
CREATE INDEX "expenses_tenant_id_expense_date_idx" ON "expenses"("tenant_id", "expense_date");

-- AddForeignKey
ALTER TABLE "member_invoices" ADD CONSTRAINT "member_invoices_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_invoices" ADD CONSTRAINT "member_invoices_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_invoices" ADD CONSTRAINT "member_invoices_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_invoice_items" ADD CONSTRAINT "member_invoice_items_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_invoice_items" ADD CONSTRAINT "member_invoice_items_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "member_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_payments" ADD CONSTRAINT "member_payments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_payments" ADD CONSTRAINT "member_payments_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_payments" ADD CONSTRAINT "member_payments_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_payments" ADD CONSTRAINT "member_payments_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "member_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_payments" ADD CONSTRAINT "member_payments_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_payments" ADD CONSTRAINT "member_payments_recorded_by_fkey" FOREIGN KEY ("recorded_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_payment_refunds" ADD CONSTRAINT "member_payment_refunds_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_payment_refunds" ADD CONSTRAINT "member_payment_refunds_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "member_payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_payment_refunds" ADD CONSTRAINT "member_payment_refunds_refunded_by_fkey" FOREIGN KEY ("refunded_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "income_entries" ADD CONSTRAINT "income_entries_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "income_entries" ADD CONSTRAINT "income_entries_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "income_entries" ADD CONSTRAINT "income_entries_source_payment_id_fkey" FOREIGN KEY ("source_payment_id") REFERENCES "member_payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "income_entries" ADD CONSTRAINT "income_entries_recorded_by_fkey" FOREIGN KEY ("recorded_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_recorded_by_fkey" FOREIGN KEY ("recorded_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
