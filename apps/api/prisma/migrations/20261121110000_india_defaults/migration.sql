-- AlterTable
ALTER TABLE "branches" ALTER COLUMN "timezone" SET DEFAULT 'Asia/Kolkata',
ALTER COLUMN "country" SET DEFAULT 'India';

-- AlterTable
ALTER TABLE "members" ALTER COLUMN "country" SET DEFAULT 'India';

-- AlterTable
ALTER TABLE "scheduled_jobs" ALTER COLUMN "timezone" SET DEFAULT 'Asia/Kolkata';

-- AlterTable
ALTER TABLE "staff_profiles" ALTER COLUMN "country" SET DEFAULT 'India';

-- AlterTable
ALTER TABLE "tenant_profiles" ALTER COLUMN "country" SET DEFAULT 'India';

-- AlterTable
ALTER TABLE "tenant_settings" ALTER COLUMN "timezone" SET DEFAULT 'Asia/Kolkata';


-- India is the default everywhere: existing rows that carried the old UTC / blank defaults move to Indian Standard Time and India.
UPDATE "tenant_settings" SET "timezone" = 'Asia/Kolkata' WHERE "timezone" = 'UTC';
UPDATE "branches" SET "timezone" = 'Asia/Kolkata' WHERE "timezone" = 'UTC';
UPDATE "scheduled_jobs" SET "timezone" = 'Asia/Kolkata' WHERE "timezone" = 'UTC';
UPDATE "branches" SET "country" = 'India' WHERE "country" IS NULL OR btrim("country") = '';
UPDATE "members" SET "country" = 'India' WHERE "country" IS NULL OR btrim("country") = '';
UPDATE "staff_profiles" SET "country" = 'India' WHERE "country" IS NULL OR btrim("country") = '';
UPDATE "tenant_profiles" SET "country" = 'India' WHERE "country" IS NULL OR btrim("country") = '';
