-- CreateEnum
CREATE TYPE "member_portal_status" AS ENUM ('PENDING_ACTIVATION', 'ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "member_verification_purpose" AS ENUM ('ACTIVATION', 'PASSWORD_RESET');

-- CreateTable
CREATE TABLE "member_credentials" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "member_id" UUID NOT NULL,
    "password_hash" TEXT NOT NULL,
    "status" "member_portal_status" NOT NULL DEFAULT 'PENDING_ACTIVATION',
    "failed_login_attempts" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMP(3),
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "member_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "member_sessions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "member_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "family" UUID NOT NULL,
    "user_agent" TEXT,
    "ip_address" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "replaced_by_token_hash" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "member_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "member_verifications" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "member_id" UUID NOT NULL,
    "purpose" "member_verification_purpose" NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "consumed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "member_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "member_credentials_member_id_key" ON "member_credentials"("member_id");

-- CreateIndex
CREATE UNIQUE INDEX "member_sessions_token_hash_key" ON "member_sessions"("token_hash");

-- CreateIndex
CREATE INDEX "member_sessions_member_id_idx" ON "member_sessions"("member_id");

-- CreateIndex
CREATE INDEX "member_sessions_family_idx" ON "member_sessions"("family");

-- CreateIndex
CREATE UNIQUE INDEX "member_verifications_token_hash_key" ON "member_verifications"("token_hash");

-- CreateIndex
CREATE INDEX "member_verifications_member_id_idx" ON "member_verifications"("member_id");

-- AddForeignKey
ALTER TABLE "member_credentials" ADD CONSTRAINT "member_credentials_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_credentials" ADD CONSTRAINT "member_credentials_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_sessions" ADD CONSTRAINT "member_sessions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_sessions" ADD CONSTRAINT "member_sessions_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_verifications" ADD CONSTRAINT "member_verifications_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_verifications" ADD CONSTRAINT "member_verifications_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;
