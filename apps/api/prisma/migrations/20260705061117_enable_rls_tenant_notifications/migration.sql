-- Row-Level Security for the new tenant-scoped table added in Prompt 10.

ALTER TABLE "tenant_notifications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tenant_notifications" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "tenant_notifications"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
