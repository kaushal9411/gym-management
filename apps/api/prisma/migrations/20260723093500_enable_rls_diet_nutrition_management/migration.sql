-- Row-Level Security for the tenant-scoped tables added in Prompt 18
-- (Diet & Nutrition Management module).

ALTER TABLE "foods" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "foods" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "foods"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

ALTER TABLE "diet_plans" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "diet_plans" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "diet_plans"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

ALTER TABLE "diet_plan_meals" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "diet_plan_meals" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "diet_plan_meals"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

ALTER TABLE "member_diet_plans" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "member_diet_plans" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "member_diet_plans"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

ALTER TABLE "member_diet_daily_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "member_diet_daily_logs" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "member_diet_daily_logs"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
