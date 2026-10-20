import type { NotificationTemplateType, TenantNotificationChannel } from '@prisma/client';

export interface DefaultTemplate {
  type: NotificationTemplateType;
  label: string;
  description: string;
  channels: TenantNotificationChannel[];
  titleTemplate: string;
  bodyTemplate: string;
}

/**
 * Hardcoded defaults for the 10 named templates the spec requires. A tenant
 * only gets a `NotificationTemplate` row once it customizes one — until then,
 * `NotificationTemplateService#getEffective` falls back to this map, so every
 * tenant "has" every template without needing a seed step at onboarding.
 * `{{variable}}` placeholders are substituted by `renderTemplate` below.
 */
export const DEFAULT_TEMPLATES: Record<NotificationTemplateType, DefaultTemplate> = {
  NEW_MEMBER_REGISTRATION: {
    type: 'NEW_MEMBER_REGISTRATION',
    label: 'New Member Registration',
    description: 'Sent to staff (in-app) when a new member is registered.',
    channels: ['IN_APP'],
    titleTemplate: 'New member registered',
    bodyTemplate: '{{memberName}} ({{memberCode}}) has joined as a new member.',
  },
  WELCOME_MESSAGE: {
    type: 'WELCOME_MESSAGE',
    label: 'Welcome Message',
    description: "Emailed and pushed to a new member's own inbox/phone at registration.",
    channels: ['IN_APP', 'EMAIL', 'PUSH'],
    titleTemplate: 'Welcome to {{tenantName}}, {{memberName}}!',
    bodyTemplate: "We're excited to have you on board. Your member ID is {{memberCode}}. See you at the gym!",
  },
  MEMBERSHIP_EXPIRY: {
    type: 'MEMBERSHIP_EXPIRY',
    label: 'Membership Expiry',
    description: 'Membership expiring soon, or already expired.',
    channels: ['IN_APP', 'EMAIL', 'PUSH'],
    titleTemplate: '{{memberName}}, your {{planName}} membership {{expiryStatus}}',
    bodyTemplate: 'Your {{planName}} membership {{expiryStatus}} on {{endDate}}. Visit the front desk to renew and keep your access uninterrupted.',
  },
  MEMBERSHIP_RENEWAL: {
    type: 'MEMBERSHIP_RENEWAL',
    label: 'Membership Renewal',
    description: 'Sent when a membership is successfully renewed.',
    channels: ['IN_APP', 'EMAIL', 'PUSH'],
    titleTemplate: 'Membership renewed',
    bodyTemplate: 'Your {{planName}} membership has been renewed and is now valid through {{endDate}}.',
  },
  PAYMENT_SUCCESS: {
    type: 'PAYMENT_SUCCESS',
    label: 'Payment Success',
    description: 'Sent when a payment is recorded as successful.',
    channels: ['IN_APP', 'EMAIL', 'PUSH'],
    titleTemplate: 'Payment received',
    bodyTemplate: 'We received your payment of {{amount}} (receipt {{paymentNumber}}). Thank you!',
  },
  PAYMENT_FAILED: {
    type: 'PAYMENT_FAILED',
    label: 'Payment Failed',
    description: 'Sent when a payment attempt fails.',
    channels: ['IN_APP', 'EMAIL', 'PUSH'],
    titleTemplate: 'Payment failed',
    bodyTemplate: 'Your payment of {{amount}} could not be processed. Please contact the front desk to resolve this.',
  },
  ATTENDANCE_CONFIRMATION: {
    type: 'ATTENDANCE_CONFIRMATION',
    label: 'Attendance Confirmation',
    description: "Sent to staff (in-app) on member check-in/check-out, and pushed to the member's own phone confirming it.",
    channels: ['IN_APP', 'PUSH'],
    titleTemplate: '{{memberName}} {{direction}}',
    bodyTemplate: '{{memberName}} {{direction}} at {{time}}.',
  },
  WORKOUT_ASSIGNMENT: {
    type: 'WORKOUT_ASSIGNMENT',
    label: 'Workout Assignment',
    description: "Sent when a workout plan is assigned to a member — in-app to staff, pushed to the member's own phone.",
    channels: ['IN_APP', 'PUSH'],
    titleTemplate: 'Workout plan assigned',
    bodyTemplate: '{{memberName}} was assigned the "{{planName}}" workout plan.',
  },
  DIET_ASSIGNMENT: {
    type: 'DIET_ASSIGNMENT',
    label: 'Diet Assignment',
    description: "Sent when a diet plan is assigned to a member — in-app to staff, pushed to the member's own phone.",
    channels: ['IN_APP', 'PUSH'],
    titleTemplate: 'Diet plan assigned',
    bodyTemplate: '{{memberName}} was assigned the "{{planName}}" diet plan.',
  },
  BIRTHDAY_WISHES: {
    type: 'BIRTHDAY_WISHES',
    label: 'Birthday Wishes',
    description: "Sent automatically every day to members whose birthday it is, via the scheduler's `birthday-wishes` job.",
    channels: ['IN_APP', 'EMAIL', 'PUSH'],
    titleTemplate: 'Happy Birthday, {{memberName}}!',
    bodyTemplate: 'Wishing you a fantastic birthday from all of us. See you at the gym!',
  },
  PAYMENT_OVERDUE: {
    type: 'PAYMENT_OVERDUE',
    label: 'Payment Overdue',
    description: 'Sent to members whose invoice is past its due date (Communications automation).',
    channels: ['IN_APP', 'EMAIL', 'PUSH'],
    titleTemplate: 'Payment overdue: {{amountDue}}',
    bodyTemplate: 'Hi {{firstName}}, invoice {{invoiceNumber}} of {{amountDue}} was due on {{dueDate}}. Please pay in the app or at the front desk.',
  },
  INVOICE_DUE_SOON: {
    type: 'INVOICE_DUE_SOON',
    label: 'Invoice Due Soon',
    description: 'Sent to members shortly before an invoice is due (Communications automation).',
    channels: ['IN_APP', 'EMAIL', 'PUSH'],
    titleTemplate: 'Payment due {{dueDate}}',
    bodyTemplate: 'Hi {{firstName}}, invoice {{invoiceNumber}} of {{amountDue}} is due on {{dueDate}}. You can pay in the app or at the front desk.',
  },
  CLASS_REMINDER: {
    type: 'CLASS_REMINDER',
    label: 'Class Reminder',
    description: 'Sent to booked members before a class starts (Communications automation).',
    channels: ['IN_APP', 'EMAIL', 'PUSH'],
    titleTemplate: 'Class reminder: {{className}}',
    bodyTemplate: 'Hi {{firstName}}, {{className}} starts on {{classDate}} at {{classTime}}. See you there!',
  },
  CLASS_SCHEDULED_OR_CHANGED: {
    type: 'CLASS_SCHEDULED_OR_CHANGED',
    label: 'Class Scheduled or Changed',
    description: 'Sent to members when a class is scheduled or its time changes (Communications automation).',
    channels: ['IN_APP', 'EMAIL', 'PUSH'],
    titleTemplate: 'Class update: {{className}}',
    bodyTemplate: 'Hi {{firstName}}, there is an update to {{className}}. Open the app to see the latest timetable.',
  },
  WE_MISS_YOU: {
    type: 'WE_MISS_YOU',
    label: 'We Miss You',
    description: 'Sent to members who have not visited for a while (Communications automation).',
    channels: ['IN_APP', 'EMAIL', 'PUSH'],
    titleTemplate: 'We miss you, {{firstName}}',
    bodyTemplate: 'It has been a while since your last visit to {{gymName}}. Come back this week and keep your streak going!',
  },
};

export function renderTemplate(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (match, key: string) => vars[key] ?? match);
}
