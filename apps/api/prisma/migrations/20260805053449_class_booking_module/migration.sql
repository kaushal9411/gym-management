-- CreateEnum
CREATE TYPE "class_session_status" AS ENUM ('SCHEDULED', 'CANCELLED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "class_booking_status" AS ENUM ('BOOKED', 'CANCELLED', 'ATTENDED', 'NO_SHOW');

-- CreateTable
CREATE TABLE "group_classes" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "description" TEXT,
    "trainer_id" UUID,
    "branch_id" UUID NOT NULL,
    "capacity" INTEGER NOT NULL,
    "duration_minutes" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "group_classes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "group_class_schedules" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "group_class_id" UUID NOT NULL,
    "day_of_week" "week_day" NOT NULL,
    "start_time" VARCHAR(5) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "group_class_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "class_sessions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "group_class_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "trainer_id" UUID,
    "session_date" DATE NOT NULL,
    "start_time" VARCHAR(5) NOT NULL,
    "end_time" VARCHAR(5) NOT NULL,
    "capacity" INTEGER NOT NULL,
    "status" "class_session_status" NOT NULL DEFAULT 'SCHEDULED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "class_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "class_bookings" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "class_session_id" UUID NOT NULL,
    "member_id" UUID NOT NULL,
    "status" "class_booking_status" NOT NULL DEFAULT 'BOOKED',
    "booked_by_role" VARCHAR(20) NOT NULL,
    "booked_by_user_id" UUID,
    "booked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelled_at" TIMESTAMP(3),

    CONSTRAINT "class_bookings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "group_classes_tenant_id_is_active_idx" ON "group_classes"("tenant_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "group_classes_tenant_id_branch_id_name_key" ON "group_classes"("tenant_id", "branch_id", "name");

-- CreateIndex
CREATE INDEX "group_class_schedules_tenant_id_group_class_id_idx" ON "group_class_schedules"("tenant_id", "group_class_id");

-- CreateIndex
CREATE INDEX "class_sessions_tenant_id_branch_id_session_date_idx" ON "class_sessions"("tenant_id", "branch_id", "session_date");

-- CreateIndex
CREATE INDEX "class_sessions_tenant_id_session_date_idx" ON "class_sessions"("tenant_id", "session_date");

-- CreateIndex
CREATE UNIQUE INDEX "class_sessions_group_class_id_session_date_start_time_key" ON "class_sessions"("group_class_id", "session_date", "start_time");

-- CreateIndex
CREATE INDEX "class_bookings_tenant_id_member_id_idx" ON "class_bookings"("tenant_id", "member_id");

-- CreateIndex
CREATE INDEX "class_bookings_tenant_id_class_session_id_idx" ON "class_bookings"("tenant_id", "class_session_id");

-- CreateIndex
CREATE UNIQUE INDEX "class_bookings_class_session_id_member_id_key" ON "class_bookings"("class_session_id", "member_id");

-- AddForeignKey
ALTER TABLE "group_classes" ADD CONSTRAINT "group_classes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_classes" ADD CONSTRAINT "group_classes_trainer_id_fkey" FOREIGN KEY ("trainer_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_classes" ADD CONSTRAINT "group_classes_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_class_schedules" ADD CONSTRAINT "group_class_schedules_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_class_schedules" ADD CONSTRAINT "group_class_schedules_group_class_id_fkey" FOREIGN KEY ("group_class_id") REFERENCES "group_classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_sessions" ADD CONSTRAINT "class_sessions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_sessions" ADD CONSTRAINT "class_sessions_group_class_id_fkey" FOREIGN KEY ("group_class_id") REFERENCES "group_classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_sessions" ADD CONSTRAINT "class_sessions_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_sessions" ADD CONSTRAINT "class_sessions_trainer_id_fkey" FOREIGN KEY ("trainer_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_bookings" ADD CONSTRAINT "class_bookings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_bookings" ADD CONSTRAINT "class_bookings_class_session_id_fkey" FOREIGN KEY ("class_session_id") REFERENCES "class_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_bookings" ADD CONSTRAINT "class_bookings_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_bookings" ADD CONSTRAINT "class_bookings_booked_by_user_id_fkey" FOREIGN KEY ("booked_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
