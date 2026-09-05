-- CreateTable
CREATE TABLE "guest_visits" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "member_id" UUID NOT NULL,
    "membership_id" UUID NOT NULL,
    "guest_name" VARCHAR(120),
    "visited_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "guest_visits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pt_session_logs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "member_id" UUID NOT NULL,
    "membership_id" UUID NOT NULL,
    "trainer_id" UUID,
    "session_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pt_session_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "guest_visits_tenant_id_member_id_idx" ON "guest_visits"("tenant_id", "member_id");

-- CreateIndex
CREATE INDEX "guest_visits_tenant_id_membership_id_idx" ON "guest_visits"("tenant_id", "membership_id");

-- CreateIndex
CREATE INDEX "pt_session_logs_tenant_id_member_id_idx" ON "pt_session_logs"("tenant_id", "member_id");

-- CreateIndex
CREATE INDEX "pt_session_logs_tenant_id_membership_id_idx" ON "pt_session_logs"("tenant_id", "membership_id");

-- AddForeignKey
ALTER TABLE "guest_visits" ADD CONSTRAINT "guest_visits_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guest_visits" ADD CONSTRAINT "guest_visits_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guest_visits" ADD CONSTRAINT "guest_visits_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pt_session_logs" ADD CONSTRAINT "pt_session_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pt_session_logs" ADD CONSTRAINT "pt_session_logs_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pt_session_logs" ADD CONSTRAINT "pt_session_logs_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pt_session_logs" ADD CONSTRAINT "pt_session_logs_trainer_id_fkey" FOREIGN KEY ("trainer_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
