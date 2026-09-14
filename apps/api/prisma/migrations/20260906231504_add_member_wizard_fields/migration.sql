-- CreateEnum
CREATE TYPE "marital_status" AS ENUM ('SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED', 'PREFER_NOT_TO_SAY');

-- CreateEnum
CREATE TYPE "body_type" AS ENUM ('ECTOMORPH', 'MESOMORPH', 'ENDOMORPH', 'AVERAGE', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "food_preference" AS ENUM ('VEGETARIAN', 'NON_VEGETARIAN', 'VEGAN', 'EGGETARIAN', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "fitness_goal" AS ENUM ('WEIGHT_LOSS', 'WEIGHT_GAIN', 'MUSCLE_BUILDING', 'GENERAL_FITNESS', 'ENDURANCE', 'REHABILITATION', 'OTHER');

-- CreateEnum
CREATE TYPE "awareness_source" AS ENUM ('SOCIAL_MEDIA', 'FRIEND_REFERRAL', 'WALK_IN', 'ADVERTISEMENT', 'ONLINE_SEARCH', 'OTHER');

-- AlterTable
ALTER TABLE "members" ADD COLUMN     "anniversary" DATE,
ADD COLUMN     "awareness_source" "awareness_source",
ADD COLUMN     "body_type" "body_type",
ADD COLUMN     "father_name_or_aadhaar" VARCHAR(200),
ADD COLUMN     "food_preference" "food_preference",
ADD COLUMN     "goal" "fitness_goal",
ADD COLUMN     "health_asthma" BOOLEAN,
ADD COLUMN     "health_bone_or_joint_problem" BOOLEAN,
ADD COLUMN     "health_diabetes_or_bp" BOOLEAN,
ADD COLUMN     "health_dizziness_or_balance" BOOLEAN,
ADD COLUMN     "health_heart_condition" BOOLEAN,
ADD COLUMN     "health_other_condition" BOOLEAN,
ADD COLUMN     "health_pain_during_activity" BOOLEAN,
ADD COLUMN     "health_screening_other_details" TEXT,
ADD COLUMN     "marital_status" "marital_status",
ADD COLUMN     "referred_by_member_id" UUID,
ADD COLUMN     "registration_fee" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "memberships" ADD COLUMN     "target_weight" DECIMAL(5,2);

-- CreateIndex
CREATE INDEX "members_tenant_id_referred_by_member_id_idx" ON "members"("tenant_id", "referred_by_member_id");

-- AddForeignKey
ALTER TABLE "members" ADD CONSTRAINT "members_referred_by_member_id_fkey" FOREIGN KEY ("referred_by_member_id") REFERENCES "members"("id") ON DELETE SET NULL ON UPDATE CASCADE;
