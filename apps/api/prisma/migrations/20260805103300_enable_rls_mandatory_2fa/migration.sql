-- Row-Level Security for the mandatory 2FA module (Prompt 42).

ALTER TABLE "mfa_backup_codes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "mfa_backup_codes" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "mfa_backup_codes"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

ALTER TABLE "mfa_setup_tokens" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "mfa_setup_tokens" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "mfa_setup_tokens"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
