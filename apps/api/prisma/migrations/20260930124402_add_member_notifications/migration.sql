-- CreateTable
CREATE TABLE "member_notifications" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "member_id" UUID NOT NULL,
    "category" "tenant_notification_category" NOT NULL DEFAULT 'GENERAL',
    "title" VARCHAR(200) NOT NULL,
    "body" TEXT NOT NULL,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "member_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "member_notifications_tenant_id_member_id_created_at_idx" ON "member_notifications"("tenant_id", "member_id", "created_at");

-- AddForeignKey
ALTER TABLE "member_notifications" ADD CONSTRAINT "member_notifications_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_notifications" ADD CONSTRAINT "member_notifications_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;
