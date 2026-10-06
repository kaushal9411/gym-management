-- Row-Level Security for the 3 tenant-scoped tables added in this prompt
-- (notification channel limits/usage/delivery log). `platform_notification_credentials`
-- is deliberately NOT here — it's platform-wide, not tenant-scoped, same
-- plane as `system_settings`/`feature_flags`.

ALTER TABLE "tenant_notification_channel_limits" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tenant_notification_channel_limits" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "tenant_notification_channel_limits"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

ALTER TABLE "tenant_notification_usage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tenant_notification_usage" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "tenant_notification_usage"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

ALTER TABLE "notification_delivery_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notification_delivery_logs" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "notification_delivery_logs"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
