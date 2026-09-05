-- CreateEnum
CREATE TYPE "payment_mode" AS ENUM ('CASH', 'BANK_TRANSFER', 'UPI', 'CHEQUE', 'CARD', 'OTHER');

-- AlterEnum
ALTER TYPE "payment_gateway_provider" ADD VALUE 'MANUAL';

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "paid_at" TIMESTAMP(3),
ADD COLUMN     "payment_mode" "payment_mode",
ADD COLUMN     "proof_url" TEXT;
