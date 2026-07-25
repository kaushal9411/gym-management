-- Row-Level Security for the tenant-scoped tables added in Prompt 17
-- (Workout Management module).

ALTER TABLE "exercises" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "exercises" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "exercises"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

ALTER TABLE "workout_plans" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "workout_plans" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "workout_plans"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

ALTER TABLE "workout_plan_exercises" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "workout_plan_exercises" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "workout_plan_exercises"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

ALTER TABLE "member_workout_plans" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "member_workout_plans" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "member_workout_plans"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

ALTER TABLE "member_workout_progress" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "member_workout_progress" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "member_workout_progress"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
