-- Row-Level Security for the tenant-scoped tables added in Prompt 19
-- (Finance Management module).

ALTER TABLE "member_invoices" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "member_invoices" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "member_invoices"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

ALTER TABLE "member_invoice_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "member_invoice_items" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "member_invoice_items"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

ALTER TABLE "member_payments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "member_payments" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "member_payments"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

ALTER TABLE "member_payment_refunds" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "member_payment_refunds" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "member_payment_refunds"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

ALTER TABLE "income_entries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "income_entries" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "income_entries"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

ALTER TABLE "expenses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "expenses" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "expenses"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
