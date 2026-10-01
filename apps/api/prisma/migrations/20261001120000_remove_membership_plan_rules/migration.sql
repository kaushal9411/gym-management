-- AlterTable
ALTER TABLE "membership_plans" DROP COLUMN "auto_renewal_allowed",
DROP COLUMN "grace_period_days",
DROP COLUMN "max_age",
DROP COLUMN "min_age",
DROP COLUMN "renewal_window_days",
DROP COLUMN "validity_end",
DROP COLUMN "validity_start";
