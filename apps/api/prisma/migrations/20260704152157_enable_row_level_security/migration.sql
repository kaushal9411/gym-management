-- ════════════════════════════════════════════════════════════════════
-- Layer 3 of tenant isolation (docs/architecture/ARCHITECTURE.md §6):
-- PostgreSQL Row-Level Security. Every tenant-scoped table gets a policy
-- keyed on the `app.tenant_id` session variable, which the tenant-scoped
-- Prisma client (infrastructure/database/tenant-scoped-client.ts) sets via
-- `set_config('app.tenant_id', ..., true)` in the same transaction as
-- every query it issues.
--
-- FORCE ROW LEVEL SECURITY is required in addition to ENABLE — otherwise
-- Postgres exempts the table owner (the role Prisma connects as) from its
-- own policies, which would silently defeat this entire layer.
--
-- `roles` and `audit_logs` allow tenant_id IS NULL (system roles / platform
-- -level audit entries) in addition to a matching tenant_id. `tenants` and
-- `permissions` are NOT covered here: tenant resolution reads `tenants`
-- before a tenant context exists (chicken-and-egg by design), and
-- `permissions` is a tenant-agnostic global catalog with no tenant_id
-- column at all.
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "users" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "users"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

ALTER TABLE "tenant_settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tenant_settings" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "tenant_settings"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

ALTER TABLE "roles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "roles" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "roles"
  USING (tenant_id IS NULL OR tenant_id = current_setting('app.tenant_id', true)::uuid);

ALTER TABLE "refresh_tokens" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "refresh_tokens" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "refresh_tokens"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

ALTER TABLE "user_sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "user_sessions" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "user_sessions"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

ALTER TABLE "password_resets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "password_resets" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "password_resets"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

ALTER TABLE "email_verifications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "email_verifications" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "email_verifications"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

ALTER TABLE "otp_codes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "otp_codes" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "otp_codes"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

ALTER TABLE "login_history" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "login_history" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "login_history"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_logs" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "audit_logs"
  USING (tenant_id IS NULL OR tenant_id = current_setting('app.tenant_id', true)::uuid);
