-- Row-Level Security for the tenant-scoped table added in this prompt
-- (Attendance Devices).

ALTER TABLE "attendance_devices" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "attendance_devices" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "attendance_devices"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
