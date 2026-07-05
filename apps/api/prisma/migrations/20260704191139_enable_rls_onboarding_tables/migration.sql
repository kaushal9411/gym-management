-- Row-Level Security for the new tenant-scoped tables added in Prompt 7
-- (see the enable_row_level_security migration for the full rationale).
-- `subscription_plans` and `subscription_features` are excluded — they are
-- a global, tenant-agnostic catalog with no tenant_id column, same as
-- `permissions`.

ALTER TABLE "subscriptions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "subscriptions" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "subscriptions"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

ALTER TABLE "tenant_domains" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tenant_domains" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "tenant_domains"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

ALTER TABLE "tenant_branding" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tenant_branding" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "tenant_branding"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

ALTER TABLE "branches" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "branches" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "branches"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

ALTER TABLE "tenant_modules" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tenant_modules" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "tenant_modules"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

ALTER TABLE "tenant_limits" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tenant_limits" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "tenant_limits"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

ALTER TABLE "tenant_usage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tenant_usage" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "tenant_usage"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
