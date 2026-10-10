-- AlterTable
ALTER TABLE "platform_notification_credentials" DROP COLUMN "twilio_account_sid",
DROP COLUMN "twilio_auth_token_encrypted",
DROP COLUMN "twilio_sms_from_number",
DROP COLUMN "twilio_whatsapp_from_number",
ADD COLUMN     "kaleyra_api_domain" TEXT,
ADD COLUMN     "kaleyra_api_key_encrypted" TEXT,
ADD COLUMN     "kaleyra_sid" TEXT,
ADD COLUMN     "kaleyra_sms_sender_id" TEXT,
ADD COLUMN     "kaleyra_whatsapp_number" TEXT;

