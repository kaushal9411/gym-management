ALTER TABLE "member_otp_codes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "member_otp_codes" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "member_otp_codes"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
