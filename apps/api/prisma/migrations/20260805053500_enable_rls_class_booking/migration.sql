-- Row-Level Security for the class/session booking module (Prompt 39).

ALTER TABLE "group_classes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "group_classes" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "group_classes"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

ALTER TABLE "group_class_schedules" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "group_class_schedules" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "group_class_schedules"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

ALTER TABLE "class_sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "class_sessions" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "class_sessions"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

ALTER TABLE "class_bookings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "class_bookings" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "class_bookings"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
