-- Idempotent backfill of the Lead & Enquiry permission keys + system-role grants
-- (mirrors prisma/seed.ts PERMISSIONS / ROLE_PERMISSIONS). System roles are global
-- (tenant_id NULL), so this covers every existing tenant. Safe to re-run.
INSERT INTO "permissions" ("id", "key", "description") VALUES
  (gen_random_uuid(), 'leads:view',    'View leads and enquiries, follow-ups and lead analytics'),
  (gen_random_uuid(), 'leads:create',  'Create a lead / log an enquiry'),
  (gen_random_uuid(), 'leads:update',  'Edit a lead, change its status, log activities'),
  (gen_random_uuid(), 'leads:delete',  'Soft-delete a lead'),
  (gen_random_uuid(), 'leads:convert', 'Convert a lead into a member'),
  (gen_random_uuid(), 'leads:assign',  'Assign or reassign a lead to a staff member'),
  (gen_random_uuid(), 'leads:export',  'Export leads as CSV')
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id"
FROM "roles" r
JOIN "permissions" p ON (
  (r."name" IN ('OWNER', 'MANAGER') AND p."key" LIKE 'leads:%')
  OR (r."name" = 'RECEPTIONIST' AND p."key" IN ('leads:view', 'leads:create', 'leads:update', 'leads:convert'))
)
WHERE r."tenant_id" IS NULL AND r."is_system" = true
ON CONFLICT DO NOTHING;
