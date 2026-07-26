-- Prompt 22 (Branch Management) — expands `branches` from Prompt 10's
-- minimal scaffold into the full branch record. `branch_code` is added
-- nullable first and backfilled (every existing tenant currently has
-- exactly one branch, so "BR-0001" is always available and unique per
-- tenant) before being made required, since `prisma migrate dev` cannot
-- add a NOT NULL column to a non-empty table without a default.

-- AlterTable: add every new column, branch_code nullable for now
ALTER TABLE "branches" ADD COLUMN     "address_line1" VARCHAR(200),
ADD COLUMN     "address_line2" VARCHAR(200),
ADD COLUMN     "allow_check_in" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "branch_code" VARCHAR(40),
ADD COLUMN     "capacity" INTEGER,
ADD COLUMN     "city" VARCHAR(100),
ADD COLUMN     "country" VARCHAR(100),
ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "email" VARCHAR(255),
ADD COLUMN     "holidays" JSONB,
ADD COLUMN     "latitude" DECIMAL(9,6),
ADD COLUMN     "longitude" DECIMAL(9,6),
ADD COLUMN     "max_members" INTEGER,
ADD COLUMN     "max_staff" INTEGER,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "operating_hours" JSONB,
ADD COLUMN     "phone" VARCHAR(30),
ADD COLUMN     "postal_code" VARCHAR(20),
ADD COLUMN     "state" VARCHAR(100),
ADD COLUMN     "whatsapp_number" VARCHAR(30);

-- Backfill: every tenant currently has exactly one branch, so "BR-0001" is
-- always available and unique per tenant.
UPDATE "branches" SET "branch_code" = 'BR-0001' WHERE "branch_code" IS NULL;

-- Now safe to require it going forward.
ALTER TABLE "branches" ALTER COLUMN "branch_code" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "branches_tenant_id_branch_code_key" ON "branches"("tenant_id", "branch_code");

-- CreateIndex
CREATE UNIQUE INDEX "branches_tenant_id_name_key" ON "branches"("tenant_id", "name");
