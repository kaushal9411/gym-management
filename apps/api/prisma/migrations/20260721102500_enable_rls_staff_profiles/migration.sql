-- Row-Level Security for the tenant-scoped table added in Prompt 13
-- (Staff Management module).

ALTER TABLE "staff_profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "staff_profiles" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "staff_profiles"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
