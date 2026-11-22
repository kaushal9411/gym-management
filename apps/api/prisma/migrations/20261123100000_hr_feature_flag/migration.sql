-- HR Management becomes a switchable module (`hr`): a plan feature (SubscriptionPlanFeature -> TenantModule) ANDed with the
-- platform kill switch (FeatureFlag). Data-only, idempotent, no schema change.
--
-- 1. Platform kill switch row (enabled by default; the seed keeps label/category in sync).
-- 2. Plan catalogue: every plan gets an `hr` feature row (Starter = off, every other plan = on), slotted in right after
--    `branches` (sort_order 4) so the plan card order matches the seed; later features shift by one. Skipped for plans that
--    already have the row, so a re-run never shifts or duplicates.
-- 3. GRANDFATHER every existing tenant: an enabled `hr` tenant_modules row (admin_override = false) for each tenant that
--    lacks one, whatever its plan, so no gym loses HR the moment the gate lands. (A later plan change/re-activation
--    re-syncs the row from the plan like every other module unless a super admin forced it.)

INSERT INTO "feature_flags" ("id", "key", "label", "category", "enabled", "created_at", "updated_at")
VALUES (gen_random_uuid(), 'hr', 'HR management', 'operations', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;

UPDATE "subscription_features" f
SET "sort_order" = f."sort_order" + 1
WHERE f."sort_order" >= 4
  AND NOT EXISTS (SELECT 1 FROM "subscription_features" x WHERE x."plan_id" = f."plan_id" AND x."key" = 'hr');

INSERT INTO "subscription_features" ("id", "plan_id", "key", "label", "included", "sort_order", "created_at")
SELECT gen_random_uuid(), p."id", 'hr', 'HR management', (p."slug" <> 'starter'), 4, CURRENT_TIMESTAMP
FROM "subscription_plans" p
ON CONFLICT ("plan_id", "key") DO NOTHING;

-- tenant_modules is FORCE-RLS (policy: tenant_id = app.tenant_id), so bind the tenant per row instead of relying on the
-- migration role bypassing RLS.
DO $$
DECLARE
  t RECORD;
BEGIN
  FOR t IN SELECT "id" FROM "tenants" LOOP
    PERFORM set_config('app.tenant_id', t."id"::text, true);
    INSERT INTO "tenant_modules" ("id", "tenant_id", "key", "enabled", "admin_override", "created_at", "updated_at")
    VALUES (gen_random_uuid(), t."id", 'hr', true, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT ("tenant_id", "key") DO NOTHING;
  END LOOP;
  PERFORM set_config('app.tenant_id', '', true);
END $$;
