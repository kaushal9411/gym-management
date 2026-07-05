-- Row-Level Security for the new tenant-scoped tables added in Prompt 8
-- (billing). `coupons`, `payment_gateways`, `tax_rules` are global/platform
-- tables with no tenant_id (same treatment as subscription_plans), and
-- `payment_transactions`/`invoice_items` are scoped transitively through
-- their parent (`payments`/`invoices`), which already carry the policy.

ALTER TABLE "subscription_history" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "subscription_history" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "subscription_history"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

ALTER TABLE "billing_addresses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "billing_addresses" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "billing_addresses"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

ALTER TABLE "payment_methods" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payment_methods" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "payment_methods"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

ALTER TABLE "payments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payments" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "payments"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

ALTER TABLE "invoices" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "invoices" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "invoices"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

ALTER TABLE "coupon_redemptions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "coupon_redemptions" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "coupon_redemptions"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
