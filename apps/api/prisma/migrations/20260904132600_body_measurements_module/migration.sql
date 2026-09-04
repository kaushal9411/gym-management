-- CreateTable
CREATE TABLE "body_measurements" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "member_id" UUID NOT NULL,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "weight_kg" DECIMAL(5,2),
    "height_cm" DECIMAL(5,2),
    "body_fat_percent" DECIMAL(4,1),
    "chest_cm" DECIMAL(5,2),
    "waist_cm" DECIMAL(5,2),
    "hips_cm" DECIMAL(5,2),
    "biceps_cm" DECIMAL(5,2),
    "thighs_cm" DECIMAL(5,2),
    "notes" TEXT,
    "recorded_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "body_measurements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "body_measurements_tenant_id_member_id_idx" ON "body_measurements"("tenant_id", "member_id");

-- CreateIndex
CREATE INDEX "body_measurements_tenant_id_recorded_at_idx" ON "body_measurements"("tenant_id", "recorded_at");

-- AddForeignKey
ALTER TABLE "body_measurements" ADD CONSTRAINT "body_measurements_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "body_measurements" ADD CONSTRAINT "body_measurements_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "body_measurements" ADD CONSTRAINT "body_measurements_recorded_by_fkey" FOREIGN KEY ("recorded_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
