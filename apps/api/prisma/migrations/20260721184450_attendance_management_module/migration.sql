-- CreateEnum
CREATE TYPE "attendance_method" AS ENUM ('QR_CODE', 'MANUAL', 'BIOMETRIC', 'FACE_RECOGNITION', 'NFC', 'RFID');

-- CreateEnum
CREATE TYPE "attendance_status" AS ENUM ('CHECKED_IN', 'CHECKED_OUT');

-- CreateTable
CREATE TABLE "attendance_records" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "member_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "check_in_time" TIMESTAMP(3) NOT NULL,
    "check_out_time" TIMESTAMP(3),
    "attendance_date" DATE NOT NULL,
    "method" "attendance_method" NOT NULL DEFAULT 'MANUAL',
    "device_name" VARCHAR(120),
    "device_id" VARCHAR(120),
    "status" "attendance_status" NOT NULL DEFAULT 'CHECKED_IN',
    "notes" TEXT,
    "checked_in_by" UUID,
    "checked_out_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "attendance_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "attendance_records_tenant_id_member_id_idx" ON "attendance_records"("tenant_id", "member_id");

-- CreateIndex
CREATE INDEX "attendance_records_tenant_id_branch_id_idx" ON "attendance_records"("tenant_id", "branch_id");

-- CreateIndex
CREATE INDEX "attendance_records_tenant_id_attendance_date_idx" ON "attendance_records"("tenant_id", "attendance_date");

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_checked_in_by_fkey" FOREIGN KEY ("checked_in_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_checked_out_by_fkey" FOREIGN KEY ("checked_out_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Business rule: "only one active check-in per member" — enforced at the DB
-- level (not just service-level), so a race between two concurrent
-- check-in requests can't create two open rows for the same member. Not
-- expressible as a plain Prisma @@unique (needs a partial WHERE clause).
CREATE UNIQUE INDEX "attendance_one_open_per_member" ON "attendance_records" ("tenant_id", "member_id") WHERE "check_out_time" IS NULL AND "deleted_at" IS NULL;
