import { beforeEach, describe, expect, it } from 'vitest';
import { vi } from 'vitest';

const TENANT = '00000000-0000-0000-0000-0000000000aa';

const state = vi.hoisted(() => ({
  limit: null as Record<string, unknown> | null,
  settings: null as Record<string, unknown> | null,
  usage: null as { sentCount: number } | null,
  upserts: [] as Array<{ where: unknown; create: unknown; update: unknown }>,
  enqueuedEmails: [] as Array<{ to: string; subject: string; html: string; notificationTenantId?: string }>,
  deliveryRecords: [] as Array<Record<string, unknown>>,
}));

vi.mock('../../../infrastructure/database/tenant-scoped-client', () => ({
  getTenantScopedClient: () => ({
    tenantNotificationChannelLimit: { findUnique: async () => state.limit },
    tenantSettings: { findUnique: async () => state.settings },
    tenantNotificationUsage: {
      findUnique: async () => state.usage,
      upsert: async (args: { where: unknown; create: unknown; update: unknown }) => {
        state.upserts.push(args);
        return {};
      },
    },
  }),
}));
vi.mock('../../../infrastructure/queue/email.queue', () => ({
  enqueueEmail: async (data: { to: string; subject: string; html: string; notificationTenantId?: string }) => {
    state.enqueuedEmails.push(data);
  },
}));
vi.mock('../repositories/notification-delivery-log.repository', () => ({
  recordNotificationDelivery: async (input: Record<string, unknown>) => {
    state.deliveryRecords.push(input);
  },
}));

import { checkAndConsumeChannelQuota, sendGatedEmail } from './channel-gate.service';

describe('checkAndConsumeChannelQuota', () => {
  beforeEach(() => {
    state.limit = null;
    state.settings = null;
    state.usage = null;
    state.upserts = [];
    state.enqueuedEmails = [];
    state.deliveryRecords = [];
  });

  it('blocks with disabled_platform when no TenantNotificationChannelLimit row exists at all', async () => {
    const result = await checkAndConsumeChannelQuota(TENANT, 'SMS');
    expect(result).toEqual({ allowed: false, reason: 'disabled_platform' });
    expect(state.upserts).toHaveLength(0);
  });

  it('blocks with disabled_platform when the super-admin ceiling has this channel off', async () => {
    state.limit = { smsEnabled: false, smsMonthlyLimit: 100, emailEnabled: true, emailMonthlyLimit: null, whatsappEnabled: true, whatsappMonthlyLimit: null };
    const result = await checkAndConsumeChannelQuota(TENANT, 'SMS');
    expect(result).toEqual({ allowed: false, reason: 'disabled_platform' });
  });

  it('blocks with disabled_tenant when the platform allows it but the tenant turned their own toggle off', async () => {
    state.limit = { smsEnabled: true, smsMonthlyLimit: null, emailEnabled: true, emailMonthlyLimit: null, whatsappEnabled: true, whatsappMonthlyLimit: null };
    state.settings = { emailNotificationsEnabled: true, smsNotificationsEnabled: false, whatsappNotificationsEnabled: true };
    const result = await checkAndConsumeChannelQuota(TENANT, 'SMS');
    expect(result).toEqual({ allowed: false, reason: 'disabled_tenant' });
  });

  it('allows and increments usage when both are on and the quota is null (unlimited)', async () => {
    state.limit = { smsEnabled: true, smsMonthlyLimit: null, emailEnabled: true, emailMonthlyLimit: null, whatsappEnabled: true, whatsappMonthlyLimit: null };
    state.settings = { emailNotificationsEnabled: true, smsNotificationsEnabled: true, whatsappNotificationsEnabled: true };
    const result = await checkAndConsumeChannelQuota(TENANT, 'SMS');
    expect(result).toEqual({ allowed: true });
    expect(state.upserts).toHaveLength(1);
  });

  it('blocks with quota_exceeded once this month\'s usage has reached the limit, without incrementing further', async () => {
    state.limit = { smsEnabled: true, smsMonthlyLimit: 2, emailEnabled: true, emailMonthlyLimit: null, whatsappEnabled: true, whatsappMonthlyLimit: null };
    state.settings = { emailNotificationsEnabled: true, smsNotificationsEnabled: true, whatsappNotificationsEnabled: true };
    state.usage = { sentCount: 2 };
    const result = await checkAndConsumeChannelQuota(TENANT, 'SMS');
    expect(result).toEqual({ allowed: false, reason: 'quota_exceeded' });
    expect(state.upserts).toHaveLength(0);
  });

  it('allows one more send when usage is still below the limit', async () => {
    state.limit = { smsEnabled: true, smsMonthlyLimit: 2, emailEnabled: true, emailMonthlyLimit: null, whatsappEnabled: true, whatsappMonthlyLimit: null };
    state.settings = { emailNotificationsEnabled: true, smsNotificationsEnabled: true, whatsappNotificationsEnabled: true };
    state.usage = { sentCount: 1 };
    const result = await checkAndConsumeChannelQuota(TENANT, 'SMS');
    expect(result).toEqual({ allowed: true });
    expect(state.upserts).toHaveLength(1);
  });

  it('defaults the tenant toggle to allowed when no TenantSettings row exists (never silently blocks on a missing row)', async () => {
    state.limit = { smsEnabled: true, smsMonthlyLimit: null, emailEnabled: true, emailMonthlyLimit: null, whatsappEnabled: true, whatsappMonthlyLimit: null };
    state.settings = null;
    const result = await checkAndConsumeChannelQuota(TENANT, 'WHATSAPP');
    expect(result).toEqual({ allowed: true });
  });
});

describe('sendGatedEmail', () => {
  beforeEach(() => {
    state.limit = null;
    state.settings = null;
    state.usage = null;
    state.upserts = [];
    state.enqueuedEmails = [];
    state.deliveryRecords = [];
  });

  it('enqueues and tags the email with notificationTenantId when the gate allows it, and returns allowed:true', async () => {
    state.limit = { emailEnabled: true, emailMonthlyLimit: null, smsEnabled: false, smsMonthlyLimit: null, whatsappEnabled: false, whatsappMonthlyLimit: null };
    state.settings = { emailNotificationsEnabled: true, smsNotificationsEnabled: false, whatsappNotificationsEnabled: false };
    const result = await sendGatedEmail(TENANT, { to: 'owner@example.com', subject: 'Hello', html: '<p>Hi</p>' });
    expect(result).toEqual({ allowed: true });
    expect(state.enqueuedEmails).toEqual([{ to: 'owner@example.com', subject: 'Hello', html: '<p>Hi</p>', notificationTenantId: TENANT }]);
    expect(state.deliveryRecords).toHaveLength(0);
  });

  it('never enqueues, records a SKIPPED_DISABLED row, and returns the blocked reason when the platform ceiling is off (e.g. no limit row yet)', async () => {
    const result = await sendGatedEmail(TENANT, { to: 'owner@example.com', subject: 'Hello', html: '<p>Hi</p>' });
    expect(result).toEqual({ allowed: false, reason: 'disabled_platform' });
    expect(state.enqueuedEmails).toHaveLength(0);
    expect(state.deliveryRecords).toEqual([
      { tenantId: TENANT, channel: 'EMAIL', recipient: 'owner@example.com', subject: 'Hello', content: '<p>Hi</p>', status: 'SKIPPED_DISABLED', errorMessage: 'disabled_platform' },
    ]);
  });

  it('never enqueues, records a SKIPPED_QUOTA row, and returns the blocked reason once the monthly limit is used up — this is what lets a caller like "Email invoice" turn a blocked send into a real error instead of a false-success toast', async () => {
    state.limit = { emailEnabled: true, emailMonthlyLimit: 1, smsEnabled: false, smsMonthlyLimit: null, whatsappEnabled: false, whatsappMonthlyLimit: null };
    state.settings = { emailNotificationsEnabled: true, smsNotificationsEnabled: false, whatsappNotificationsEnabled: false };
    state.usage = { sentCount: 1 };
    const result = await sendGatedEmail(TENANT, { to: 'owner@example.com', subject: 'Hello', html: '<p>Hi</p>' });
    expect(result).toEqual({ allowed: false, reason: 'quota_exceeded' });
    expect(state.enqueuedEmails).toHaveLength(0);
    expect(state.deliveryRecords).toEqual([
      { tenantId: TENANT, channel: 'EMAIL', recipient: 'owner@example.com', subject: 'Hello', content: '<p>Hi</p>', status: 'SKIPPED_QUOTA', errorMessage: 'quota_exceeded' },
    ]);
  });
});
