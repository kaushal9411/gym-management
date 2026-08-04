-- CreateTable
CREATE TABLE "tenant_ai_settings" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "provider" VARCHAR(30),
    "model" VARCHAR(120),
    "api_key_encrypted" TEXT,
    "base_url" TEXT,
    "temperature" DOUBLE PRECISION,
    "max_tokens" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_ai_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenant_ai_settings_tenant_id_key" ON "tenant_ai_settings"("tenant_id");

-- AddForeignKey
ALTER TABLE "tenant_ai_settings" ADD CONSTRAINT "tenant_ai_settings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
