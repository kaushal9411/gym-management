-- CreateEnum
CREATE TYPE "member_otp_purpose" AS ENUM ('MOBILE_LOGIN');

-- AlterEnum
ALTER TYPE "otp_purpose" ADD VALUE 'MOBILE_LOGIN';

-- CreateTable
CREATE TABLE "member_otp_codes" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "member_id" UUID NOT NULL,
    "code_hash" TEXT NOT NULL,
    "purpose" "member_otp_purpose" NOT NULL,
    "channel" "otp_channel" NOT NULL DEFAULT 'EMAIL',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 5,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "consumed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "member_otp_codes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "member_otp_codes_member_id_purpose_idx" ON "member_otp_codes"("member_id", "purpose");

-- AddForeignKey
ALTER TABLE "member_otp_codes" ADD CONSTRAINT "member_otp_codes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_otp_codes" ADD CONSTRAINT "member_otp_codes_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;
