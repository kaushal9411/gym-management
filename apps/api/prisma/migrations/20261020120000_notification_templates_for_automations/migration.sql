-- Notification templates for the five Communications automations that had none, so every
-- automation can follow (and be switched off from) Notification settings.
ALTER TYPE "notification_template_type" ADD VALUE IF NOT EXISTS 'PAYMENT_OVERDUE';
ALTER TYPE "notification_template_type" ADD VALUE IF NOT EXISTS 'INVOICE_DUE_SOON';
ALTER TYPE "notification_template_type" ADD VALUE IF NOT EXISTS 'CLASS_REMINDER';
ALTER TYPE "notification_template_type" ADD VALUE IF NOT EXISTS 'CLASS_SCHEDULED_OR_CHANGED';
ALTER TYPE "notification_template_type" ADD VALUE IF NOT EXISTS 'WE_MISS_YOU';
