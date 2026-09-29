-- Row-Level Security for the tenant-scoped tables added for push
-- notifications (FCM device-token registration).

ALTER TABLE "staff_device_tokens" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "staff_device_tokens" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "staff_device_tokens"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

ALTER TABLE "member_device_tokens" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "member_device_tokens" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "member_device_tokens"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
