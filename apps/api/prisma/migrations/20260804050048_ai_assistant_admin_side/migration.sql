-- CreateTable
CREATE TABLE "admin_ai_conversations" (
    "id" UUID NOT NULL,
    "admin_user_id" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL DEFAULT 'New conversation',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_ai_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_ai_messages" (
    "id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "role" "ai_message_role" NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_ai_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_ai_request_logs" (
    "id" UUID NOT NULL,
    "admin_user_id" UUID NOT NULL,
    "conversation_id" UUID,
    "provider" VARCHAR(60) NOT NULL,
    "model" VARCHAR(120) NOT NULL,
    "prompt_tokens" INTEGER,
    "completion_tokens" INTEGER,
    "duration_ms" INTEGER,
    "status" VARCHAR(20) NOT NULL,
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_ai_request_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_ai_settings" (
    "id" UUID NOT NULL,
    "provider" VARCHAR(30),
    "model" VARCHAR(120),
    "api_key_encrypted" TEXT,
    "base_url" TEXT,
    "temperature" DOUBLE PRECISION,
    "max_tokens" INTEGER,
    "updated_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_ai_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "admin_ai_conversations_admin_user_id_updated_at_idx" ON "admin_ai_conversations"("admin_user_id", "updated_at");

-- CreateIndex
CREATE INDEX "admin_ai_messages_conversation_id_created_at_idx" ON "admin_ai_messages"("conversation_id", "created_at");

-- CreateIndex
CREATE INDEX "admin_ai_request_logs_created_at_idx" ON "admin_ai_request_logs"("created_at");

-- AddForeignKey
ALTER TABLE "admin_ai_conversations" ADD CONSTRAINT "admin_ai_conversations_admin_user_id_fkey" FOREIGN KEY ("admin_user_id") REFERENCES "admin_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_ai_messages" ADD CONSTRAINT "admin_ai_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "admin_ai_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
