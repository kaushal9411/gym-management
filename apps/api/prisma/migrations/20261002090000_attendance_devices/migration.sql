-- CreateEnum
CREATE TYPE "attendance_device_vendor" AS ENUM ('ZKTECO', 'ESSL', 'GENERIC', 'OTHER');

-- AlterTable
ALTER TABLE "members" ADD COLUMN     "biometric_id" VARCHAR(40);

-- CreateTable
CREATE TABLE "attendance_devices" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "vendor" "attendance_device_vendor" NOT NULL DEFAULT 'GENERIC',
    "api_key_hash" TEXT NOT NULL,
    "last_seen_at" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "attendance_devices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "attendance_devices_api_key_hash_key" ON "attendance_devices"("api_key_hash");

-- CreateIndex
CREATE INDEX "attendance_devices_tenant_id_branch_id_idx" ON "attendance_devices"("tenant_id", "branch_id");

-- CreateIndex
CREATE UNIQUE INDEX "members_tenant_id_biometric_id_key" ON "members"("tenant_id", "biometric_id");

-- AddForeignKey
ALTER TABLE "attendance_devices" ADD CONSTRAINT "attendance_devices_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_devices" ADD CONSTRAINT "attendance_devices_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
