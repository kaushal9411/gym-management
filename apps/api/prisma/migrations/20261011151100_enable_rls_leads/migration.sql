ALTER TABLE "leads" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "leads" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "leads"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

ALTER TABLE "lead_activities" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "lead_activities" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "lead_activities"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
