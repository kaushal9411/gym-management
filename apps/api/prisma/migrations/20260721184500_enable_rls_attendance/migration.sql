-- Row-Level Security for the tenant-scoped table added in Prompt 16
-- (Attendance Management module).

ALTER TABLE "attendance_records" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "attendance_records" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "attendance_records"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
