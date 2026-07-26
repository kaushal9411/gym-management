-- Row-Level Security for the tenant-scoped tables added in Prompt 21
-- (Notifications & Communication module).

ALTER TABLE "tenant_announcements" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tenant_announcements" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "tenant_announcements"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

ALTER TABLE "notification_templates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notification_templates" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "notification_templates"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
