-- Member self-tracking: mark who authored a body-measurement entry.
-- Existing table, so no new RLS migration is needed (the tenant_isolation
-- policy from 20260904132700_enable_rls_body_measurements is row-scoped and
-- covers the new column automatically).

-- CreateEnum
CREATE TYPE "MeasurementSource" AS ENUM ('STAFF', 'MEMBER');

-- AlterTable (every pre-existing row was staff-recorded -> default STAFF)
ALTER TABLE "body_measurements" ADD COLUMN "source" "MeasurementSource" NOT NULL DEFAULT 'STAFF';

-- At most one MEMBER-logged entry per member per day. Member entries store
-- recorded_at normalised to UTC midnight, so equality == same calendar day.
-- Partial index (Prisma cannot model it; same precedent as
-- attendance_one_open_per_member) - STAFF rows are unaffected.
CREATE UNIQUE INDEX "body_measurements_one_member_entry_per_day" ON "body_measurements" ("tenant_id", "member_id", "recorded_at") WHERE "source" = 'MEMBER';
