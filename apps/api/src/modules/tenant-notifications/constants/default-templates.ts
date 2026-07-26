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
 * tenant "has" all 10 templates without needing a seed step at onboarding.
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
    description: "Emailed to a new member's own inbox at registration.",
    channels: ['IN_APP', 'EMAIL'],
    titleTemplate: 'Welcome to {{tenantName}}, {{memberName}}!',
    bodyTemplate: "We're excited to have you on board. Your member ID is {{memberCode}}. See you at the gym!",
  },
  MEMBERSHIP_EXPIRY: {
    type: 'MEMBERSHIP_EXPIRY',
    label: 'Membership Expiry',
    description: 'Membership expiring soon, or already expired.',
    channels: ['IN_APP', 'EMAIL'],
    titleTemplate: '{{memberName}}, your {{planName}} membership {{expiryStatus}}',
    bodyTemplate: 'Your {{planName}} membership {{expiryStatus}} on {{endDate}}. Visit the front desk to renew and keep your access uninterrupted.',
  },
  MEMBERSHIP_RENEWAL: {
    type: 'MEMBERSHIP_RENEWAL',
    label: 'Membership Renewal',
    description: 'Sent when a membership is successfully renewed.',
    channels: ['IN_APP', 'EMAIL'],
    titleTemplate: 'Membership renewed',
    bodyTemplate: 'Your {{planName}} membership has been renewed and is now valid through {{endDate}}.',
  },
  PAYMENT_SUCCESS: {
    type: 'PAYMENT_SUCCESS',
    label: 'Payment Success',
    description: 'Sent when a payment is recorded as successful.',
    channels: ['IN_APP', 'EMAIL'],
    titleTemplate: 'Payment received',
    bodyTemplate: 'We received your payment of {{amount}} (receipt {{paymentNumber}}). Thank you!',
  },
  PAYMENT_FAILED: {
    type: 'PAYMENT_FAILED',
    label: 'Payment Failed',
    description: 'Sent when a payment attempt fails.',
    channels: ['IN_APP', 'EMAIL'],
    titleTemplate: 'Payment failed',
    bodyTemplate: 'Your payment of {{amount}} could not be processed. Please contact the front desk to resolve this.',
  },
  ATTENDANCE_CONFIRMATION: {
    type: 'ATTENDANCE_CONFIRMATION',
    label: 'Attendance Confirmation',
    description: 'Sent to staff (in-app) on member check-in/check-out.',
    channels: ['IN_APP'],
    titleTemplate: '{{memberName}} {{direction}}',
    bodyTemplate: '{{memberName}} {{direction}} at {{time}}.',
  },
  WORKOUT_ASSIGNMENT: {
    type: 'WORKOUT_ASSIGNMENT',
    label: 'Workout Assignment',
    description: 'Sent when a workout plan is assigned to a member.',
    channels: ['IN_APP'],
    titleTemplate: 'Workout plan assigned',
    bodyTemplate: '{{memberName}} was assigned the "{{planName}}" workout plan.',
  },
  DIET_ASSIGNMENT: {
    type: 'DIET_ASSIGNMENT',
    label: 'Diet Assignment',
    description: 'Sent when a diet plan is assigned to a member.',
    channels: ['IN_APP'],
    titleTemplate: 'Diet plan assigned',
    bodyTemplate: '{{memberName}} was assigned the "{{planName}}" diet plan.',
  },
  BIRTHDAY_WISHES: {
    type: 'BIRTHDAY_WISHES',
    label: 'Birthday Wishes',
    description: 'Available for manual/future use — no automatic birthday sweep exists yet (not in the trigger-events list this module implements).',
    channels: ['IN_APP', 'EMAIL'],
    titleTemplate: 'Happy Birthday, {{memberName}}!',
    bodyTemplate: 'Wishing you a fantastic birthday from all of us. See you at the gym!',
  },
};

export function renderTemplate(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (match, key: string) => vars[key] ?? match);
}
