-- CreateEnum
CREATE TYPE "measurement_unit" AS ENUM ('METRIC', 'IMPERIAL');

-- CreateEnum
CREATE TYPE "theme_preference" AS ENUM ('LIGHT', 'DARK', 'SYSTEM');

-- AlterTable
ALTER TABLE "tenant_branding" ADD COLUMN     "dashboard_banner_url" TEXT,
ADD COLUMN     "email_logo_url" TEXT,
ADD COLUMN     "login_background_url" TEXT,
ADD COLUMN     "theme" "theme_preference" NOT NULL DEFAULT 'SYSTEM';

-- AlterTable
ALTER TABLE "tenant_settings" ADD COLUMN     "currency_symbol" VARCHAR(8) NOT NULL DEFAULT '$',
ADD COLUMN     "date_format" VARCHAR(20) NOT NULL DEFAULT 'MM/DD/YYYY',
ADD COLUMN     "email_notifications_enabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "measurement_unit" "measurement_unit" NOT NULL DEFAULT 'METRIC',
ADD COLUMN     "push_notifications_enabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "sms_notifications_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sms_provider_config" JSONB,
ADD COLUMN     "time_format" VARCHAR(4) NOT NULL DEFAULT '12h',
ADD COLUMN     "week_start_day" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "tenant_profiles" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "legal_business_name" VARCHAR(160),
    "registration_number" VARCHAR(60),
    "gst_vat_number" VARCHAR(40),
    "business_type" VARCHAR(60),
    "description" TEXT,
    "email" VARCHAR(255),
    "phone" VARCHAR(20),
    "alternate_phone" VARCHAR(20),
    "website" VARCHAR(255),
    "address_line" VARCHAR(200),
    "city" VARCHAR(100),
    "state" VARCHAR(100),
    "country" VARCHAR(100),
    "postal_code" VARCHAR(20),
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "business_hours" JSONB,
    "social_links" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_invoice_settings" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "invoice_prefix" VARCHAR(20) NOT NULL DEFAULT 'INV',
    "invoice_footer" TEXT,
    "tax_percentage" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "default_payment_terms_days" INTEGER NOT NULL DEFAULT 15,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_invoice_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenant_profiles_tenant_id_key" ON "tenant_profiles"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_invoice_settings_tenant_id_key" ON "tenant_invoice_settings"("tenant_id");

-- AddForeignKey
ALTER TABLE "tenant_profiles" ADD CONSTRAINT "tenant_profiles_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_invoice_settings" ADD CONSTRAINT "tenant_invoice_settings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
