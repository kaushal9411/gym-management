-- CreateEnum
CREATE TYPE "app_release_platform" AS ENUM ('ANDROID');

-- CreateTable
CREATE TABLE "app_releases" (
    "id" UUID NOT NULL,
    "platform" "app_release_platform" NOT NULL DEFAULT 'ANDROID',
    "version" VARCHAR(40) NOT NULL,
    "version_code" INTEGER NOT NULL,
    "file_name" VARCHAR(200) NOT NULL,
    "file_key" TEXT NOT NULL,
    "file_size" BIGINT NOT NULL,
    "release_notes" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "uploaded_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "app_releases_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "app_releases_platform_is_active_idx" ON "app_releases"("platform", "is_active");

-- AddForeignKey
ALTER TABLE "app_releases" ADD CONSTRAINT "app_releases_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
