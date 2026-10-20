import type { NotificationTemplateType } from '@prisma/client';

import { notificationTemplateService } from '../../tenant-notifications/services/notification-template.service';
import { CAMPAIGN_PLACEHOLDERS, findPlaceholderIssues } from '../utils/placeholder.util';

/** Member-facing Notification templates that can start a campaign (staff-only ones such as attendance / assignments are not offered). */
const CAMPAIGN_TEMPLATE_TYPES: NotificationTemplateType[] = ['MEMBERSHIP_EXPIRY', 'MEMBERSHIP_RENEWAL', 'PAYMENT_SUCCESS', 'PAYMENT_FAILED', 'WELCOME_MESSAGE', 'BIRTHDAY_WISHES'];

/** Old-style tokens the Notification templates use -> the campaign placeholder set. */
const TOKEN_MAP: Record<string, string> = {
  memberName: '{{firstName}}',
  tenantName: '{{gymName}}',
  amount: '{{amountDue}}',
  expiryStatus: 'ends',
};

export interface SyncedTemplate {
  type: NotificationTemplateType;
  label: string;
  description: string;
  title: string;
  body: string;
  customized: boolean;
}

export function toCampaignText(text: string): string {
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (m, name: string) => TOKEN_MAP[name] ?? m);
}

/**
 * The gym's Notification templates (Settings -> Notifications -> Templates) as campaign starter text.
 * Switched-off templates are left out, as are ones whose text needs a value a campaign cannot supply.
 * Read live on every call, so an edit or toggle in Notification settings shows up immediately.
 */
export async function listSyncedTemplates(tenantId: string): Promise<SyncedTemplate[]> {
  const all = await notificationTemplateService.list(tenantId);
  const items: SyncedTemplate[] = [];
  for (const t of all) {
    if (!CAMPAIGN_TEMPLATE_TYPES.includes(t.type) || !t.isActive) continue;
    const title = toCampaignText(t.titleTemplate);
    const body = toCampaignText(t.bodyTemplate);
    if (findPlaceholderIssues(title, CAMPAIGN_PLACEHOLDERS).length || findPlaceholderIssues(body, CAMPAIGN_PLACEHOLDERS).length) continue;
    items.push({ type: t.type, label: t.label, description: t.description, title, body, customized: t.isCustomized });
  }
  return items;
}
