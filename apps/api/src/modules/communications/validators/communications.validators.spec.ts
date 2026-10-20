import { describe, expect, it } from 'vitest';

import { AUTOMATION_RULES } from '../constants/automation-rules';

import {
  audienceFilterSchema,
  automationIssues,
  createCampaignSchema,
  memberPreferencesSchema,
  previewSchema,
  putAutomationSchema,
  scheduleIssue,
  sendCampaignSchema,
  testSendSchema,
  updateCampaignSchema,
} from './communications.validators';

const UUID = '3f2b8a0e-5c1d-4d6e-9a47-0b1c2d3e4f50';
const later = (ms: number): string => new Date(Date.now() + ms).toISOString();
const DAY = 86_400_000;

const valid = {
  title: 'Hi {{firstName}}, a note from {{gymName}}',
  body: 'We have extended weekday closing time to 10 pm.',
  channels: ['PUSH', 'IN_APP'],
  audienceMode: 'FILTERS',
};

const issuesOf = (result: { success: boolean; error?: { issues: Array<{ path: Array<string | number>; message: string }> } }): string[] =>
  result.success ? [] : result.error!.issues.map((i) => `${i.path.join('.')}: ${i.message}`);

describe('createCampaignSchema', () => {
  it('accepts a minimal valid campaign and applies defaults', () => {
    const r = createCampaignSchema.safeParse(valid);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.sendMode).toBe('NOW');
      expect(r.data.holdQuietHours).toBe(true);
      expect(r.data.confirmLargeSend).toBe(false);
    }
  });

  it('rejects an unknown placeholder with a clear message', () => {
    const msgs = issuesOf(createCampaignSchema.safeParse({ ...valid, body: 'Hello {{nickname}}' }));
    expect(msgs.join('\n')).toMatch(/body: Unknown placeholder \{\{nickname\}\}/);
  });

  it('rejects empty channels and duplicate channels', () => {
    expect(issuesOf(createCampaignSchema.safeParse({ ...valid, channels: [] })).join()).toMatch(/at least one channel/i);
    expect(issuesOf(createCampaignSchema.safeParse({ ...valid, channels: ['PUSH', 'PUSH'] })).join()).toMatch(/only be listed once/);
    expect(createCampaignSchema.safeParse({ ...valid, channels: ['TELEGRAM'] }).success).toBe(false);
  });

  it('title <= 200 and body <= 2000 characters, both required', () => {
    expect(createCampaignSchema.safeParse({ ...valid, title: 'x'.repeat(201) }).success).toBe(false);
    expect(createCampaignSchema.safeParse({ ...valid, title: 'x'.repeat(200) }).success).toBe(true);
    expect(createCampaignSchema.safeParse({ ...valid, body: 'x'.repeat(2001) }).success).toBe(false);
    expect(createCampaignSchema.safeParse({ ...valid, body: '   ' }).success).toBe(false);
    expect(createCampaignSchema.safeParse({ ...valid, title: '' }).success).toBe(false);
  });

  it('SMS text (title + body) is capped at 1000 characters', () => {
    const r = createCampaignSchema.safeParse({ ...valid, channels: ['SMS'], body: 'x'.repeat(1100) });
    expect(issuesOf(r).join()).toMatch(/SMS the title and message together/);
    expect(createCampaignSchema.safeParse({ ...valid, channels: ['EMAIL'], body: 'x'.repeat(1100) }).success).toBe(true);
  });

  it('scheduling needs scheduledAt, which must be in the future and within 90 days', () => {
    expect(issuesOf(createCampaignSchema.safeParse({ ...valid, sendMode: 'SCHEDULE' })).join()).toMatch(/scheduledAt is required/);
    expect(issuesOf(createCampaignSchema.safeParse({ ...valid, sendMode: 'SCHEDULE', scheduledAt: later(-DAY) })).join()).toMatch(/in the future/);
    expect(issuesOf(createCampaignSchema.safeParse({ ...valid, sendMode: 'SCHEDULE', scheduledAt: later(10_000) })).join()).toMatch(/in the future/);
    expect(issuesOf(createCampaignSchema.safeParse({ ...valid, sendMode: 'SCHEDULE', scheduledAt: later(91 * DAY) })).join()).toMatch(/at most 90 days/);
    expect(createCampaignSchema.safeParse({ ...valid, sendMode: 'SCHEDULE', scheduledAt: later(2 * DAY) }).success).toBe(true);
    expect(createCampaignSchema.safeParse({ ...valid, sendMode: 'SCHEDULE', scheduledAt: later(89 * DAY) }).success).toBe(true);
    expect(createCampaignSchema.safeParse({ ...valid, sendMode: 'SCHEDULE', scheduledAt: 'tomorrow' }).success).toBe(false);
  });

  it('sending now with a scheduledAt is contradictory', () => {
    expect(issuesOf(createCampaignSchema.safeParse({ ...valid, scheduledAt: later(DAY) })).join()).toMatch(/cannot be used with sendMode NOW/);
  });

  it('PICKED needs ids; FILTERS must not carry ids; ids are deduped and capped at 5000', () => {
    expect(issuesOf(createCampaignSchema.safeParse({ ...valid, audienceMode: 'PICKED' })).join()).toMatch(/Pick at least one member/);
    expect(issuesOf(createCampaignSchema.safeParse({ ...valid, pickedMemberIds: [UUID] })).join()).toMatch(/only be used with audienceMode PICKED/);
    const ok = createCampaignSchema.safeParse({ ...valid, audienceMode: 'PICKED', pickedMemberIds: [UUID, UUID] });
    expect(ok.success && ok.data.pickedMemberIds).toEqual([UUID]);
    const many = Array.from({ length: 5001 }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`);
    expect(createCampaignSchema.safeParse({ ...valid, audienceMode: 'PICKED', pickedMemberIds: many }).success).toBe(false);
    expect(createCampaignSchema.safeParse({ ...valid, audienceMode: 'PICKED', pickedMemberIds: ['not-a-uuid'] }).success).toBe(false);
  });

  it('is strict: unknown keys are rejected (no mass assignment of status / tenantId)', () => {
    expect(createCampaignSchema.safeParse({ ...valid, status: 'SENT' }).success).toBe(false);
    expect(createCampaignSchema.safeParse({ ...valid, tenantId: UUID }).success).toBe(false);
    expect(createCampaignSchema.safeParse({ ...valid, createdBy: UUID }).success).toBe(false);
  });
});

describe('audienceFilterSchema', () => {
  it('accepts every documented filter', () => {
    const r = audienceFilterSchema.safeParse({
      membershipStatus: 'EXPIRING',
      expiringWithinDays: 7,
      planIds: [UUID],
      branchIds: [UUID],
      trainerIds: [UUID],
      hasTrainer: true,
      hasOverdueInvoice: true,
      hasUnpaidInvoice: true,
      notVisitedDays: 14,
      birthdayThisWeek: true,
      bookedClassSessionId: UUID,
    });
    expect(r.success).toBe(true);
  });
  it('rejects unknown keys, out-of-range numbers and a stray expiringWithinDays', () => {
    expect(audienceFilterSchema.safeParse({ gender: 'MALE' }).success).toBe(false);
    expect(audienceFilterSchema.safeParse({ notVisitedDays: 0 }).success).toBe(false);
    expect(audienceFilterSchema.safeParse({ notVisitedDays: 400 }).success).toBe(false);
    expect(audienceFilterSchema.safeParse({ membershipStatus: 'EXPIRING', expiringWithinDays: 91 }).success).toBe(false);
    expect(audienceFilterSchema.safeParse({ expiringWithinDays: 7 }).success).toBe(false);
    expect(audienceFilterSchema.safeParse({ planIds: [] }).success).toBe(false);
  });
});

describe('updateCampaignSchema', () => {
  it('needs at least one field, validates placeholders and stays strict', () => {
    expect(updateCampaignSchema.safeParse({}).success).toBe(false);
    expect(updateCampaignSchema.safeParse({ title: 'Hi {{firstName}}' }).success).toBe(true);
    expect(issuesOf(updateCampaignSchema.safeParse({ body: '{{oops}}' })).join()).toMatch(/Unknown placeholder/);
    expect(updateCampaignSchema.safeParse({ status: 'SENT' }).success).toBe(false);
    expect(updateCampaignSchema.safeParse({ scheduledAt: later(-DAY) }).success).toBe(false);
  });
});

describe('previewSchema / sendCampaignSchema / testSendSchema', () => {
  it('preview accepts the minimum and requires ids for PICKED', () => {
    expect(previewSchema.safeParse({ audienceMode: 'FILTERS' }).success).toBe(true);
    expect(previewSchema.safeParse({ audienceMode: 'PICKED' }).success).toBe(false);
    expect(previewSchema.safeParse({ audienceMode: 'FILTERS', channels: ['EMAIL', 'SMS'], extra: 1 }).success).toBe(false);
  });
  it('send is strict', () => {
    expect(sendCampaignSchema.safeParse({}).success).toBe(true);
    expect(sendCampaignSchema.safeParse({ confirmLargeSend: true }).success).toBe(true);
    expect(sendCampaignSchema.safeParse({ confirmLargeSend: 'yes' }).success).toBe(false);
  });
  it('test-send reaches only the staff member own channels (no IN_APP) and validates placeholders', () => {
    expect(testSendSchema.safeParse({ title: 'T', body: 'B', channels: ['EMAIL', 'SMS'] }).success).toBe(true);
    expect(testSendSchema.safeParse({ title: 'T', body: 'B', channels: ['IN_APP'] }).success).toBe(false);
    expect(testSendSchema.safeParse({ title: 'T', body: 'B', channels: [] }).success).toBe(false);
    expect(testSendSchema.safeParse({ title: 'T', body: '{{x}}', channels: ['EMAIL'] }).success).toBe(false);
    expect(testSendSchema.safeParse({ title: 'T', body: 'B', channels: ['EMAIL'], to: 'someone@else.com' }).success).toBe(false);
  });
});

describe('scheduleIssue', () => {
  const now = new Date('2026-10-19T10:00:00Z');
  it('enforces the window relative to now', () => {
    expect(scheduleIssue('2026-10-19T10:00:30Z', now)).toMatch(/future/);
    expect(scheduleIssue('2026-10-19T10:02:00Z', now)).toBeNull();
    expect(scheduleIssue('2027-02-01T10:00:00Z', now)).toMatch(/90 days/);
  });
});

describe('automation rule validation', () => {
  const put = (over: Record<string, unknown> = {}) => putAutomationSchema.parse({ enabled: true, channels: ['PUSH', 'EMAIL'], offsets: [7, 3, 1], ...over });

  it('a valid editable rule passes', () => {
    expect(automationIssues(AUTOMATION_RULES.MEMBERSHIP_EXPIRING, put())).toEqual([]);
  });
  it('offsets: range, count, duplicates and presence', () => {
    expect(automationIssues(AUTOMATION_RULES.MEMBERSHIP_EXPIRING, put({ offsets: [0] }))[0]?.message).toMatch(/between 1 and 60/);
    expect(automationIssues(AUTOMATION_RULES.MEMBERSHIP_EXPIRING, put({ offsets: [61] }))[0]?.message).toMatch(/between 1 and 60/);
    expect(automationIssues(AUTOMATION_RULES.MEMBERSHIP_EXPIRING, put({ offsets: [1, 2, 3, 4, 5, 6] }))[0]?.message).toMatch(/At most 5/);
    expect(automationIssues(AUTOMATION_RULES.MEMBERSHIP_EXPIRING, put({ offsets: [3, 3] }))[0]?.message).toMatch(/only be listed once/);
    expect(automationIssues(AUTOMATION_RULES.MEMBERSHIP_EXPIRING, put({ offsets: undefined }))[0]?.message).toMatch(/at least one timing/);
    expect(automationIssues(AUTOMATION_RULES.CLASS_REMINDER, put({ offsets: [24, 2] }))).toEqual([]);
    expect(automationIssues(AUTOMATION_RULES.CLASS_REMINDER, put({ offsets: [100] }))[0]?.message).toMatch(/between 1 and 72/);
    expect(automationIssues(AUTOMATION_RULES.WE_MISS_YOU, put({ offsets: [3] }))[0]?.message).toMatch(/between 7 and 90/);
  });
  it('fixed-timing rules refuse offsets', () => {
    expect(automationIssues(AUTOMATION_RULES.BIRTHDAY, put({ offsets: [0] }))[0]?.message).toMatch(/fixed timing/);
    expect(automationIssues(AUTOMATION_RULES.BIRTHDAY, put({ offsets: undefined }))).toEqual([]);
    expect(automationIssues(AUTOMATION_RULES.CLASS_SCHEDULED_OR_CHANGED, put({ offsets: undefined, channels: ['PUSH', 'IN_APP'] }))).toEqual([]);
  });
  it('enabled needs a channel (schema level) and channels are validated', () => {
    expect(putAutomationSchema.safeParse({ enabled: true, channels: [], offsets: [7] }).success).toBe(false);
    expect(putAutomationSchema.safeParse({ enabled: true, channels: ['FAX'], offsets: [7] }).success).toBe(false);
  });
  it('title / body overrides may only use the rule allowed placeholders', () => {
    expect(automationIssues(AUTOMATION_RULES.MEMBERSHIP_EXPIRING, put({ title: 'Ends {{endDate}} ({{daysLeft}})' }))).toEqual([]);
    expect(automationIssues(AUTOMATION_RULES.MEMBERSHIP_EXPIRING, put({ body: 'Class {{className}}' }))[0]?.message).toMatch(/Unknown placeholder \{\{className\}\}/);
    expect(automationIssues(AUTOMATION_RULES.CLASS_REMINDER, put({ offsets: [24], body: 'See you at {{className}} {{classTime}}' }))).toEqual([]);
  });
  it('is strict', () => {
    expect(putAutomationSchema.safeParse({ enabled: true, channels: ['PUSH'], offsets: [7], tenantId: UUID }).success).toBe(false);
  });
});

describe('memberPreferencesSchema', () => {
  it('accepts opt-outs for the four blockable channels only', () => {
    expect(memberPreferencesSchema.safeParse({ channels: [{ channel: 'SMS', promotionalOptOut: true }] }).success).toBe(true);
    expect(memberPreferencesSchema.safeParse({ channels: [{ channel: 'IN_APP', promotionalOptOut: true }] }).success).toBe(false);
    expect(memberPreferencesSchema.safeParse({ channels: [] }).success).toBe(false);
    expect(memberPreferencesSchema.safeParse({ channels: [{ channel: 'SMS', promotionalOptOut: true }, { channel: 'SMS', promotionalOptOut: false }] }).success).toBe(false);
  });
  it('a member can never name another member or tenant', () => {
    expect(memberPreferencesSchema.safeParse({ memberId: UUID, channels: [{ channel: 'SMS', promotionalOptOut: true }] }).success).toBe(false);
    expect(memberPreferencesSchema.safeParse({ channels: [{ channel: 'SMS', promotionalOptOut: true, memberId: UUID }] }).success).toBe(false);
  });
});
