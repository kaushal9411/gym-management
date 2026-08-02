-- DropIndex
DROP INDEX "support_tickets_tenant_id_idx";

-- CreateIndex
CREATE INDEX "attendance_records_tenant_id_check_in_time_idx" ON "attendance_records"("tenant_id", "check_in_time");

-- CreateIndex
CREATE INDEX "attendance_records_tenant_id_branch_id_attendance_date_idx" ON "attendance_records"("tenant_id", "branch_id", "attendance_date");

-- CreateIndex
CREATE INDEX "audit_logs_tenant_id_actor_user_id_idx" ON "audit_logs"("tenant_id", "actor_user_id");

-- CreateIndex
CREATE INDEX "expenses_tenant_id_branch_id_expense_date_idx" ON "expenses"("tenant_id", "branch_id", "expense_date");

-- CreateIndex
CREATE INDEX "income_entries_tenant_id_branch_id_income_date_idx" ON "income_entries"("tenant_id", "branch_id", "income_date");

-- CreateIndex
CREATE INDEX "member_invoices_tenant_id_branch_id_status_idx" ON "member_invoices"("tenant_id", "branch_id", "status");

-- CreateIndex
CREATE INDEX "member_invoices_tenant_id_created_at_idx" ON "member_invoices"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "member_payments_tenant_id_branch_id_payment_date_idx" ON "member_payments"("tenant_id", "branch_id", "payment_date");

-- CreateIndex
CREATE INDEX "members_tenant_id_created_at_idx" ON "members"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "members_tenant_id_trainer_id_idx" ON "members"("tenant_id", "trainer_id");

-- CreateIndex
CREATE INDEX "membership_plans_tenant_id_is_active_idx" ON "membership_plans"("tenant_id", "is_active");

-- CreateIndex
CREATE INDEX "staff_profiles_tenant_id_work_status_idx" ON "staff_profiles"("tenant_id", "work_status");

-- CreateIndex
CREATE INDEX "support_tickets_tenant_id_status_created_at_idx" ON "support_tickets"("tenant_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "users_tenant_id_created_at_idx" ON "users"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "users_tenant_id_last_login_at_idx" ON "users"("tenant_id", "last_login_at");
