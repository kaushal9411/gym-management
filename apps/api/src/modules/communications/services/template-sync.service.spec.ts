import { beforeEach, describe, expect, it, vi } from 'vitest';

const list = vi.fn();
vi.mock('../../tenant-notifications/services/notification-template.service', () => ({ notificationTemplateService: { list: (...a: unknown[]) => list(...a) } }));

import { listSyncedTemplates, toCampaignText } from './template-sync.service';

const tpl = (type: string, over: Record<string, unknown> = {}) => ({
  type,
  label: type,
  description: '',
  channels: [],
  titleTemplate: 'Hello {{memberName}}',
  bodyTemplate: 'From {{tenantName}}: pay {{amount}}',
  isActive: true,
  isCustomized: true,
  ...over,
});

describe('template sync', () => {
  beforeEach(() => list.mockReset());

  it('maps old-style tokens to campaign placeholders', () => {
    expect(toCampaignText('{{memberName}} {{planName}} {{expiryStatus}} at {{tenantName}} {{amount}}')).toBe('{{firstName}} {{planName}} ends at {{gymName}} {{amountDue}}');
  });

  it('offers active member-facing templates with the current (edited) text', async () => {
    list.mockResolvedValue([tpl('PAYMENT_FAILED')]);
    expect(await listSyncedTemplates('t1')).toEqual([
      { type: 'PAYMENT_FAILED', label: 'PAYMENT_FAILED', description: '', title: 'Hello {{firstName}}', body: 'From {{gymName}}: pay {{amountDue}}', customized: true },
    ]);
  });

  it('hides switched-off, staff-only and unmappable templates', async () => {
    list.mockResolvedValue([
      tpl('PAYMENT_FAILED', { isActive: false }),
      tpl('ATTENDANCE_CONFIRMATION'),
      tpl('PAYMENT_SUCCESS', { bodyTemplate: 'Receipt {{paymentNumber}}' }),
      tpl('BIRTHDAY_WISHES'),
    ]);
    expect((await listSyncedTemplates('t1')).map((t) => t.type)).toEqual(['BIRTHDAY_WISHES']);
  });
});
