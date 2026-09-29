-- CreateEnum
CREATE TYPE "device_token_platform" AS ENUM ('ANDROID', 'IOS', 'WEB');

-- CreateTable
CREATE TABLE "staff_device_tokens" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token" VARCHAR(255) NOT NULL,
    "platform" "device_token_platform" NOT NULL DEFAULT 'ANDROID',
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_device_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "member_device_tokens" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "member_id" UUID NOT NULL,
    "token" VARCHAR(255) NOT NULL,
    "platform" "device_token_platform" NOT NULL DEFAULT 'ANDROID',
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "member_device_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "staff_device_tokens_token_key" ON "staff_device_tokens"("token");

-- CreateIndex
CREATE INDEX "staff_device_tokens_tenant_id_user_id_idx" ON "staff_device_tokens"("tenant_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "member_device_tokens_token_key" ON "member_device_tokens"("token");

-- CreateIndex
CREATE INDEX "member_device_tokens_tenant_id_member_id_idx" ON "member_device_tokens"("tenant_id", "member_id");

-- AddForeignKey
ALTER TABLE "staff_device_tokens" ADD CONSTRAINT "staff_device_tokens_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_device_tokens" ADD CONSTRAINT "staff_device_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_device_tokens" ADD CONSTRAINT "member_device_tokens_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_device_tokens" ADD CONSTRAINT "member_device_tokens_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;
