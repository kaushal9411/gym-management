-- AlterTable
ALTER TABLE "subscription_plans" ALTER COLUMN "currency" SET DEFAULT 'INR';

-- AlterTable
ALTER TABLE "tenant_settings" ALTER COLUMN "currency" SET DEFAULT 'INR',
ALTER COLUMN "currency_symbol" SET DEFAULT '₹';
