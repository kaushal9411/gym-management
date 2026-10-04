-- ADMIN-ONLY tables that carry a tenant_id. The usual `tenant_id = app.tenant_id` policy would let a tenant session
-- read its own internal notes/tags, so these policies admit ONLY sessions that explicitly set `app.admin_plane = 'on'`
-- (done by the admin-tenants services inside a transaction). Tenant/member sessions never set it.

ALTER TABLE "tenant_admin_notes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tenant_admin_notes" FORCE ROW LEVEL SECURITY;
CREATE POLICY admin_plane_only ON "tenant_admin_notes"
  USING (current_setting('app.admin_plane', true) = 'on')
  WITH CHECK (current_setting('app.admin_plane', true) = 'on');

ALTER TABLE "tenant_admin_tags" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tenant_admin_tags" FORCE ROW LEVEL SECURITY;
CREATE POLICY admin_plane_only ON "tenant_admin_tags"
  USING (current_setting('app.admin_plane', true) = 'on')
  WITH CHECK (current_setting('app.admin_plane', true) = 'on');
