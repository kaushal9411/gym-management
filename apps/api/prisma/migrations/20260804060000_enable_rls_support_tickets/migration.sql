-- Row-Level Security for `support_tickets` — was missing RLS even though
-- every other tenant-scoped table has it (tenant isolation was previously
-- enforced only by the application-level `tenantId` filter in
-- TicketRepository, as documented in that file's own header comment).
-- `tenant_id` is nullable (a ticket can predate any tenant), so a NULL row
-- correctly stays invisible to every tenant session — `NULL = uuid` is
-- never true in Postgres. The admin plane (cross-tenant ticket queue) reads
-- via the raw, non-tenant-scoped client and is unaffected.

ALTER TABLE "support_tickets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "support_tickets" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "support_tickets"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
