-- Row-Level Security for the tenant-scoped tables added in the AI Business
-- Assistant module.

ALTER TABLE "ai_conversations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ai_conversations" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "ai_conversations"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

ALTER TABLE "ai_messages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ai_messages" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "ai_messages"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

ALTER TABLE "ai_request_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ai_request_logs" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "ai_request_logs"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
