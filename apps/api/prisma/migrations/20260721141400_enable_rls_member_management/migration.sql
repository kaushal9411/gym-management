-- Row-Level Security for the tenant-scoped tables added in Prompt 14
-- (Member Management module).

ALTER TABLE "membership_plans" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "membership_plans" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "membership_plans"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

ALTER TABLE "members" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "members" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "members"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

ALTER TABLE "memberships" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "memberships" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "memberships"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

ALTER TABLE "membership_freezes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "membership_freezes" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "membership_freezes"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

ALTER TABLE "member_documents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "member_documents" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "member_documents"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
