-- Row-Level Security for the member-auth-plane tables added for the member
-- self-service portal (Prompt 39).

ALTER TABLE "member_credentials" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "member_credentials" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "member_credentials"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

ALTER TABLE "member_sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "member_sessions" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "member_sessions"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

ALTER TABLE "member_verifications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "member_verifications" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "member_verifications"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
