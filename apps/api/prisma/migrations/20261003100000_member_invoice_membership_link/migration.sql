-- Links the auto-managed "Balance due" invoice to the membership it covers.
-- Column only: member_invoices already has RLS enabled, so no policy change is needed.
ALTER TABLE "member_invoices" ADD COLUMN "membership_id" UUID;

ALTER TABLE "member_invoices"
  ADD CONSTRAINT "member_invoices_membership_id_fkey"
  FOREIGN KEY ("membership_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "member_invoices_tenant_id_membership_id_idx" ON "member_invoices"("tenant_id", "membership_id");
