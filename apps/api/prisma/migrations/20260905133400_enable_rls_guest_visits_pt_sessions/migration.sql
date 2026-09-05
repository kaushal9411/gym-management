-- Row-Level Security for the two tenant-scoped tables added in this prompt
-- (Guest Passes tracking, PT Session tracking).

ALTER TABLE "guest_visits" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "guest_visits" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "guest_visits"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

ALTER TABLE "pt_session_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "pt_session_logs" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "pt_session_logs"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
