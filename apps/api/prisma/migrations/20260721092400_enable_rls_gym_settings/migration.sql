-- Row-Level Security for the tenant-scoped tables added in Prompt 12
-- (Gym Profile, Branding & Business Settings). tenant_settings and
-- tenant_branding already have RLS from earlier migrations.

ALTER TABLE "tenant_profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tenant_profiles" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "tenant_profiles"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

ALTER TABLE "tenant_invoice_settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tenant_invoice_settings" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "tenant_invoice_settings"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
