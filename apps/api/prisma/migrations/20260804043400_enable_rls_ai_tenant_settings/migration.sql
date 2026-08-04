-- Row-Level Security for the tenant-scoped table added for AI Assistant tenant BYOK.

ALTER TABLE "tenant_ai_settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tenant_ai_settings" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "tenant_ai_settings"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
