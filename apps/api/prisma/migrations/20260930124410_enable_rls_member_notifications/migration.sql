-- Row-Level Security for the member notification history table.

ALTER TABLE "member_notifications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "member_notifications" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "member_notifications"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
