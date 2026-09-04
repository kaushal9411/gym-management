-- Row-Level Security for the tenant-scoped table added in this prompt
-- (Body Measurements).

ALTER TABLE "body_measurements" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "body_measurements" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "body_measurements"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
