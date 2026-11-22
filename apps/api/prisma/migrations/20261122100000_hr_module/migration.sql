-- CreateEnum
CREATE TYPE "hr_day_part" AS ENUM ('FULL_DAY', 'HALF_DAY_MORNING', 'HALF_DAY_EVENING');

-- CreateEnum
CREATE TYPE "hr_leave_status" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "hr_attendance_status" AS ENUM ('PRESENT', 'ABSENT', 'HALF_DAY', 'LATE', 'ON_LEAVE', 'WEEKLY_OFF', 'HOLIDAY');

-- CreateEnum
CREATE TYPE "hr_attendance_source" AS ENUM ('SELF', 'MANUAL', 'SYSTEM');

-- CreateEnum
CREATE TYPE "hr_pay_component_type" AS ENUM ('ALLOWANCE', 'DEDUCTION');

-- CreateEnum
CREATE TYPE "hr_payroll_status" AS ENUM ('DRAFT', 'APPROVED', 'PAID');

-- CreateEnum
CREATE TYPE "hr_payslip_status" AS ENUM ('DRAFT', 'PAID');

-- CreateEnum
CREATE TYPE "hr_payment_mode" AS ENUM ('CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE', 'OTHER');

-- AlterTable
ALTER TABLE "staff_profiles" ADD COLUMN     "shift_id" UUID;

-- CreateTable
CREATE TABLE "hr_policies" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "leave_year_start_month" INTEGER NOT NULL DEFAULT 4,
    "default_weekly_off" VARCHAR(80) NOT NULL DEFAULT 'SUNDAY',
    "late_grace_minutes" INTEGER NOT NULL DEFAULT 10,
    "half_day_threshold_hours" DECIMAL(4,1) NOT NULL DEFAULT 4,
    "standard_day_hours" DECIMAL(4,1) NOT NULL DEFAULT 8,
    "late_penalty_enabled" BOOLEAN NOT NULL DEFAULT false,
    "late_penalty_lates_per_unit" INTEGER NOT NULL DEFAULT 3,
    "late_penalty_days" DECIMAL(3,1) NOT NULL DEFAULT 0.5,
    "overtime_enabled" BOOLEAN NOT NULL DEFAULT false,
    "overtime_multiplier" DECIMAL(3,2) NOT NULL DEFAULT 1.5,
    "backdate_leave_days" INTEGER NOT NULL DEFAULT 30,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hr_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_leave_types" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "code" VARCHAR(12) NOT NULL,
    "yearly_quota" DECIMAL(5,1),
    "is_paid" BOOLEAN NOT NULL DEFAULT true,
    "carry_forward" BOOLEAN NOT NULL DEFAULT false,
    "carry_forward_max" DECIMAL(5,1),
    "color" VARCHAR(20) NOT NULL DEFAULT '#6366f1',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hr_leave_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_leave_balances" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "leave_type_id" UUID NOT NULL,
    "leave_year" INTEGER NOT NULL,
    "quota" DECIMAL(5,1) NOT NULL DEFAULT 0,
    "carried_forward" DECIMAL(5,1) NOT NULL DEFAULT 0,
    "adjustment" DECIMAL(5,1) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hr_leave_balances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_leave_requests" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "leave_type_id" UUID NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "day_part" "hr_day_part" NOT NULL DEFAULT 'FULL_DAY',
    "days" DECIMAL(4,1) NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "hr_leave_status" NOT NULL DEFAULT 'PENDING',
    "leave_year" INTEGER NOT NULL,
    "applied_on_behalf" BOOLEAN NOT NULL DEFAULT false,
    "applied_by" UUID,
    "decided_by" UUID,
    "decided_at" TIMESTAMP(3),
    "decision_remark" TEXT,
    "cancelled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hr_leave_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_staff_attendance" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "status" "hr_attendance_status" NOT NULL,
    "check_in_at" TIMESTAMP(3),
    "check_out_at" TIMESTAMP(3),
    "worked_minutes" INTEGER,
    "late_minutes" INTEGER NOT NULL DEFAULT 0,
    "overtime_minutes" INTEGER NOT NULL DEFAULT 0,
    "source" "hr_attendance_source" NOT NULL,
    "marked_by" UUID,
    "remark" TEXT,
    "leave_request_id" UUID,
    "shift_name" VARCHAR(80),
    "shift_start" VARCHAR(5),
    "shift_end" VARCHAR(5),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hr_staff_attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_shifts" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "start_time" VARCHAR(5) NOT NULL,
    "end_time" VARCHAR(5) NOT NULL,
    "grace_minutes" INTEGER NOT NULL DEFAULT 10,
    "weekly_off_days" VARCHAR(80) NOT NULL DEFAULT 'SUNDAY',
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hr_shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_holidays" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" TEXT,
    "branch_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hr_holidays_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_pay_components" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "type" "hr_pay_component_type" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hr_pay_components_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_payroll_runs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "month" VARCHAR(7) NOT NULL,
    "status" "hr_payroll_status" NOT NULL DEFAULT 'DRAFT',
    "employee_count" INTEGER NOT NULL DEFAULT 0,
    "total_gross" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total_deductions" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total_net" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "created_by" UUID,
    "approved_by" UUID,
    "approved_at" TIMESTAMP(3),
    "paid_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hr_payroll_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_payslips" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "run_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "month" VARCHAR(7) NOT NULL,
    "status" "hr_payslip_status" NOT NULL DEFAULT 'DRAFT',
    "employee_code" VARCHAR(40) NOT NULL,
    "employee_name" VARCHAR(160) NOT NULL,
    "role_name" VARCHAR(60) NOT NULL,
    "salary_type" VARCHAR(20) NOT NULL,
    "working_days" INTEGER NOT NULL,
    "present_days" DECIMAL(4,1) NOT NULL,
    "half_days" DECIMAL(4,1) NOT NULL,
    "paid_leave_days" DECIMAL(4,1) NOT NULL,
    "unpaid_leave_days" DECIMAL(4,1) NOT NULL,
    "absent_days" DECIMAL(4,1) NOT NULL,
    "holiday_days" INTEGER NOT NULL,
    "weekly_off_days" INTEGER NOT NULL,
    "not_employed_days" INTEGER NOT NULL,
    "late_count" INTEGER NOT NULL,
    "overtime_minutes" INTEGER NOT NULL,
    "unpaid_days" DECIMAL(4,1) NOT NULL,
    "daily_rate" DECIMAL(12,2) NOT NULL,
    "base_salary" DECIMAL(12,2) NOT NULL,
    "fixed_allowances" DECIMAL(12,2) NOT NULL,
    "monthly_gross" DECIMAL(12,2) NOT NULL,
    "attendance_deduction" DECIMAL(12,2) NOT NULL,
    "overtime_pay" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "extra_allowances" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "bonus" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "gross_earnings" DECIMAL(12,2) NOT NULL,
    "fixed_deductions" DECIMAL(12,2) NOT NULL,
    "extra_deductions" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "late_penalty" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "advance_recovery" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total_deductions" DECIMAL(12,2) NOT NULL,
    "net_pay" DECIMAL(12,2) NOT NULL,
    "lines" JSONB NOT NULL DEFAULT '[]',
    "notes" JSONB NOT NULL DEFAULT '[]',
    "paid_at" TIMESTAMP(3),
    "paid_on" DATE,
    "payment_mode" "hr_payment_mode",
    "paid_by" UUID,
    "paid_remark" TEXT,
    "expense_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hr_payslips_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_notifications" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" VARCHAR(40) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "body" TEXT NOT NULL,
    "entity_type" VARCHAR(40),
    "entity_id" UUID,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hr_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "hr_policies_tenant_id_key" ON "hr_policies"("tenant_id");

-- CreateIndex
CREATE INDEX "hr_leave_types_tenant_id_is_active_idx" ON "hr_leave_types"("tenant_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "hr_leave_types_tenant_id_code_key" ON "hr_leave_types"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "hr_leave_balances_tenant_id_leave_year_idx" ON "hr_leave_balances"("tenant_id", "leave_year");

-- CreateIndex
CREATE UNIQUE INDEX "hr_leave_balances_user_id_leave_type_id_leave_year_key" ON "hr_leave_balances"("user_id", "leave_type_id", "leave_year");

-- CreateIndex
CREATE INDEX "hr_leave_requests_tenant_id_status_created_at_idx" ON "hr_leave_requests"("tenant_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "hr_leave_requests_tenant_id_user_id_start_date_idx" ON "hr_leave_requests"("tenant_id", "user_id", "start_date");

-- CreateIndex
CREATE INDEX "hr_leave_requests_tenant_id_start_date_end_date_idx" ON "hr_leave_requests"("tenant_id", "start_date", "end_date");

-- CreateIndex
CREATE INDEX "hr_staff_attendance_tenant_id_date_idx" ON "hr_staff_attendance"("tenant_id", "date");

-- CreateIndex
CREATE INDEX "hr_staff_attendance_leave_request_id_idx" ON "hr_staff_attendance"("leave_request_id");

-- CreateIndex
CREATE UNIQUE INDEX "hr_staff_attendance_tenant_id_user_id_date_key" ON "hr_staff_attendance"("tenant_id", "user_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "hr_shifts_tenant_id_name_key" ON "hr_shifts"("tenant_id", "name");

-- CreateIndex
CREATE INDEX "hr_holidays_tenant_id_date_idx" ON "hr_holidays"("tenant_id", "date");

-- CreateIndex
CREATE INDEX "hr_pay_components_tenant_id_user_id_idx" ON "hr_pay_components"("tenant_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "hr_payroll_runs_tenant_id_month_key" ON "hr_payroll_runs"("tenant_id", "month");

-- CreateIndex
CREATE UNIQUE INDEX "hr_payslips_expense_id_key" ON "hr_payslips"("expense_id");

-- CreateIndex
CREATE INDEX "hr_payslips_tenant_id_user_id_month_idx" ON "hr_payslips"("tenant_id", "user_id", "month");

-- CreateIndex
CREATE UNIQUE INDEX "hr_payslips_run_id_user_id_key" ON "hr_payslips"("run_id", "user_id");

-- CreateIndex
CREATE INDEX "hr_notifications_tenant_id_user_id_read_at_created_at_idx" ON "hr_notifications"("tenant_id", "user_id", "read_at", "created_at");

-- AddForeignKey
ALTER TABLE "staff_profiles" ADD CONSTRAINT "staff_profiles_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "hr_shifts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_policies" ADD CONSTRAINT "hr_policies_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_leave_types" ADD CONSTRAINT "hr_leave_types_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_leave_balances" ADD CONSTRAINT "hr_leave_balances_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_leave_balances" ADD CONSTRAINT "hr_leave_balances_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_leave_balances" ADD CONSTRAINT "hr_leave_balances_leave_type_id_fkey" FOREIGN KEY ("leave_type_id") REFERENCES "hr_leave_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_leave_requests" ADD CONSTRAINT "hr_leave_requests_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_leave_requests" ADD CONSTRAINT "hr_leave_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_leave_requests" ADD CONSTRAINT "hr_leave_requests_leave_type_id_fkey" FOREIGN KEY ("leave_type_id") REFERENCES "hr_leave_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_staff_attendance" ADD CONSTRAINT "hr_staff_attendance_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_staff_attendance" ADD CONSTRAINT "hr_staff_attendance_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_staff_attendance" ADD CONSTRAINT "hr_staff_attendance_leave_request_id_fkey" FOREIGN KEY ("leave_request_id") REFERENCES "hr_leave_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_shifts" ADD CONSTRAINT "hr_shifts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_holidays" ADD CONSTRAINT "hr_holidays_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_holidays" ADD CONSTRAINT "hr_holidays_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_pay_components" ADD CONSTRAINT "hr_pay_components_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_pay_components" ADD CONSTRAINT "hr_pay_components_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_payroll_runs" ADD CONSTRAINT "hr_payroll_runs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_payslips" ADD CONSTRAINT "hr_payslips_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_payslips" ADD CONSTRAINT "hr_payslips_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "hr_payroll_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_payslips" ADD CONSTRAINT "hr_payslips_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_payslips" ADD CONSTRAINT "hr_payslips_expense_id_fkey" FOREIGN KEY ("expense_id") REFERENCES "expenses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_notifications" ADD CONSTRAINT "hr_notifications_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_notifications" ADD CONSTRAINT "hr_notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;



-- ── Row-Level Security: every HR table is tenant-scoped (hand-written, same
-- shape as membership_transfers / every other tenant table). ───────────────
ALTER TABLE "hr_policies" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "hr_policies" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "hr_policies"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

ALTER TABLE "hr_leave_types" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "hr_leave_types" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "hr_leave_types"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

ALTER TABLE "hr_leave_balances" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "hr_leave_balances" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "hr_leave_balances"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

ALTER TABLE "hr_leave_requests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "hr_leave_requests" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "hr_leave_requests"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

ALTER TABLE "hr_staff_attendance" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "hr_staff_attendance" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "hr_staff_attendance"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

ALTER TABLE "hr_shifts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "hr_shifts" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "hr_shifts"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

ALTER TABLE "hr_holidays" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "hr_holidays" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "hr_holidays"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

ALTER TABLE "hr_pay_components" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "hr_pay_components" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "hr_pay_components"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

ALTER TABLE "hr_payroll_runs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "hr_payroll_runs" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "hr_payroll_runs"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

ALTER TABLE "hr_payslips" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "hr_payslips" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "hr_payslips"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

ALTER TABLE "hr_notifications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "hr_notifications" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "hr_notifications"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- ── Permission catalogue + system-role grants (mirrors prisma/seed.ts).
-- System roles are global (tenant_id NULL) so this covers every existing
-- tenant. Idempotent. ──────────────────────────────────────────────────────
INSERT INTO "permissions" ("id", "key", "description") VALUES
  (gen_random_uuid(), 'hr:view',              'View the HR overview, employees, all-staff attendance, leave types, holidays, shifts and policy'),
  (gen_random_uuid(), 'hr:attendance_manage', 'Mark, edit or clear any employee''s attendance'),
  (gen_random_uuid(), 'hr:leave_manage',      'See all leave requests; approve, reject, cancel or apply leave on behalf; manage leave types, holidays and balances'),
  (gen_random_uuid(), 'hr:payroll_manage',    'Pay structures, payroll runs, payslips and marking salary paid'),
  (gen_random_uuid(), 'hr:settings_manage',   'Manage shifts, shift assignment and the HR policy'),
  (gen_random_uuid(), 'hr:self_attendance',   'Check in/out and view own attendance'),
  (gen_random_uuid(), 'hr:self_leave',        'Apply for and cancel own leave, view own leave balances'),
  (gen_random_uuid(), 'hr:self_payslip',      'View own payslips')
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id"
FROM "roles" r
JOIN "permissions" p ON (
  (r."name" = 'OWNER' AND p."key" LIKE 'hr:%')
  OR (r."name" = 'MANAGER' AND p."key" IN ('hr:view', 'hr:attendance_manage', 'hr:leave_manage', 'hr:settings_manage', 'hr:self_attendance', 'hr:self_leave', 'hr:self_payslip'))
  OR (r."name" IN ('TRAINER', 'RECEPTIONIST') AND p."key" IN ('hr:self_attendance', 'hr:self_leave', 'hr:self_payslip'))
)
WHERE r."tenant_id" IS NULL AND r."is_system" = true
ON CONFLICT DO NOTHING;

-- ── Per-tenant defaults for EXISTING tenants (new tenants get the same rows
-- from HrDefaultsService at provisioning). Idempotent. ──────────────────────
INSERT INTO "hr_policies" ("id", "tenant_id", "updated_at")
SELECT gen_random_uuid(), t."id", CURRENT_TIMESTAMP FROM "tenants" t
ON CONFLICT ("tenant_id") DO NOTHING;

INSERT INTO "hr_leave_types" ("id", "tenant_id", "name", "code", "yearly_quota", "is_paid", "carry_forward", "carry_forward_max", "color", "sort_order", "updated_at")
SELECT gen_random_uuid(), t."id", d."name", d."code", d."quota", d."paid", d."cf", d."cfmax", d."color", d."ord", CURRENT_TIMESTAMP
FROM "tenants" t
CROSS JOIN (VALUES
  ('Casual Leave', 'CASUAL', 12.0, true,  false, NULL::numeric, '#6366f1', 1),
  ('Sick Leave',   'SICK',    8.0, true,  false, NULL::numeric, '#ef4444', 2),
  ('Paid Leave',   'PAID',   15.0, true,  true,  15.0,          '#10b981', 3),
  ('Unpaid Leave', 'UNPAID', NULL::numeric, false, false, NULL::numeric, '#64748b', 4)
) AS d("name", "code", "quota", "paid", "cf", "cfmax", "color", "ord")
ON CONFLICT ("tenant_id", "code") DO NOTHING;

INSERT INTO "hr_shifts" ("id", "tenant_id", "name", "start_time", "end_time", "grace_minutes", "weekly_off_days", "is_default", "updated_at")
SELECT gen_random_uuid(), t."id", 'General', '06:00', '21:00', 10, 'SUNDAY', true, CURRENT_TIMESTAMP FROM "tenants" t
ON CONFLICT ("tenant_id", "name") DO NOTHING;
