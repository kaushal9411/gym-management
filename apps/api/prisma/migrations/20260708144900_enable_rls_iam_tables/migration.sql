-- Row-Level Security for the tenant-scoped IAM tables added in Prompt 11.
-- (permissions / role_permissions / user_roles remain global-catalog tables
-- without tenant_id; their isolation is enforced at the application layer
-- through tenant-scoped role lookups.)

ALTER TABLE "user_permissions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "user_permissions" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "user_permissions"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

ALTER TABLE "user_branches" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "user_branches" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "user_branches"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

ALTER TABLE "user_invitations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "user_invitations" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "user_invitations"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
