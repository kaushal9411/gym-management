-- Row-Level Security for the tenant-scoped table added in Prompt 20
-- (Reports & Analytics module).

ALTER TABLE "scheduled_reports" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "scheduled_reports" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "scheduled_reports"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
