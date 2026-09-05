import { renderEmailLayout, type EmailBranding } from './base-layout';

/**
 * Wraps a tenant-customized notification (title + body come from
 * `NotificationTemplate`/`DEFAULT_TEMPLATES` — free text a tenant can edit,
 * not fixed copy this codebase controls) in the same branded shell every
 * other email uses. Previously these went out as a bare `<p>${body}</p>`
 * with zero layout/branding at all — the one category of email that had
 * never been through `renderEmailLayout`.
 */
export function tenantNotificationEmail(branding: EmailBranding, title: string, body: string) {
  return {
    subject: title,
    html: renderEmailLayout(
      branding,
      { icon: '🔔', title, categoryLabel: 'Notification', preheader: body },
      `<p>${body}</p>`,
    ),
  };
}
