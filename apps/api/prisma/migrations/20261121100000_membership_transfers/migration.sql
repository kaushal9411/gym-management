-- AlterTable
ALTER TABLE "tenant_settings" ADD COLUMN     "membership_transfer_fee" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "membership_transfers" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "from_member_id" UUID NOT NULL,
    "to_member_id" UUID NOT NULL,
    "from_membership_id" UUID NOT NULL,
    "to_membership_id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "plan_name" VARCHAR(120) NOT NULL,
    "original_start_date" DATE NOT NULL,
    "original_end_date" DATE NOT NULL,
    "days_used" INTEGER NOT NULL,
    "days_remaining" INTEGER NOT NULL,
    "price_at_assignment" DECIMAL(10,2) NOT NULL,
    "fee" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "reason" TEXT,
    "transferred_by" UUID,
    "transferred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "membership_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "membership_transfers_from_membership_id_key" ON "membership_transfers"("from_membership_id");

-- CreateIndex
CREATE UNIQUE INDEX "membership_transfers_to_membership_id_key" ON "membership_transfers"("to_membership_id");

-- CreateIndex
CREATE INDEX "membership_transfers_tenant_id_from_member_id_idx" ON "membership_transfers"("tenant_id", "from_member_id");

-- CreateIndex
CREATE INDEX "membership_transfers_tenant_id_to_member_id_idx" ON "membership_transfers"("tenant_id", "to_member_id");

-- AddForeignKey
ALTER TABLE "membership_transfers" ADD CONSTRAINT "membership_transfers_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership_transfers" ADD CONSTRAINT "membership_transfers_from_member_id_fkey" FOREIGN KEY ("from_member_id") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership_transfers" ADD CONSTRAINT "membership_transfers_to_member_id_fkey" FOREIGN KEY ("to_member_id") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership_transfers" ADD CONSTRAINT "membership_transfers_from_membership_id_fkey" FOREIGN KEY ("from_membership_id") REFERENCES "memberships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership_transfers" ADD CONSTRAINT "membership_transfers_to_membership_id_fkey" FOREIGN KEY ("to_membership_id") REFERENCES "memberships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership_transfers" ADD CONSTRAINT "membership_transfers_transferred_by_fkey" FOREIGN KEY ("transferred_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Row-Level Security: membership_transfers is tenant-scoped (hand-written, same
-- shape as every other tenant table — see enable_rls_guest_visits_pt_sessions).
ALTER TABLE "membership_transfers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "membership_transfers" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "membership_transfers"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
