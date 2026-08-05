-- AlterTable
ALTER TABLE "members" ADD COLUMN     "email_hash" TEXT,
ADD COLUMN     "phone_hash" TEXT,
ALTER COLUMN "email" SET DATA TYPE TEXT,
ALTER COLUMN "phone" SET DATA TYPE TEXT;

-- CreateIndex
CREATE INDEX "members_tenant_id_email_hash_idx" ON "members"("tenant_id", "email_hash");

-- CreateIndex
CREATE INDEX "members_tenant_id_phone_hash_idx" ON "members"("tenant_id", "phone_hash");
