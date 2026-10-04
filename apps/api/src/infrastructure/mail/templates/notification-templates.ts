import {
  alertBox,
  detailRow,
  detailTable,
  escapeHtml,
  footnote,
  paragraph,
  renderEmailLayout,
  sectionTitle,
  textBlock,
  type EmailBranding,
} from './base-layout';

/**
 * Wraps a tenant-customised notification (title + body are free text a tenant can edit — ALWAYS escaped here)
 * in the shared branded shell.
 */
export function tenantNotificationEmail(branding: EmailBranding, title: string, body: string) {
  return {
    subject: title,
    html: renderEmailLayout(
      branding,
      { icon: '🔔', title, categoryLabel: 'Notification', subtitle: `A message from ${branding.tenantName}`, preheader: body, footerHint: 'preferences' },
      `<div class="fc-soft" style="margin:4px 0 16px;padding:16px 18px;border-radius:14px;background:#f7f8fc;border:1px solid #e6e8f0;font-size:15.5px;line-height:1.7;color:#2b2f3b;">${textBlock(body)}</div>
       ${footnote(`This message was sent by ${branding.tenantName}.`)}`,
    ),
  };
}

/** Platform (super-admin) announcement broadcast to tenant owners. */
export function platformAnnouncementEmail(branding: EmailBranding, title: string, body: string) {
  return {
    subject: title,
    html: renderEmailLayout(
      branding,
      { icon: '📣', title, categoryLabel: 'Platform announcement', subtitle: 'An update from the FitCloud team', preheader: body, footerHint: 'preferences' },
      `<div class="fc-soft" style="margin:4px 0 16px;padding:16px 18px;border-radius:14px;background:#f7f8fc;border:1px solid #e6e8f0;font-size:15.5px;line-height:1.7;color:#2b2f3b;">${textBlock(body)}</div>
       ${footnote('You’re receiving this as the owner of a gym on FitCloud.')}`,
    ),
  };
}

/** Inbound sales/billing inquiry from the public contact form, mailed to the FitCloud team. */
export function contactInquiryEmail(
  branding: EmailBranding,
  input: { topic: 'sales' | 'billing'; name: string; email: string; phone?: string; gymSlug?: string; message: string },
) {
  const sales = input.topic === 'sales';
  return {
    subject: `[${input.topic}] Inquiry from ${input.name}${input.gymSlug ? ` (${input.gymSlug})` : ''}`.replace(/[\r\n]+/g, ' '),
    html: renderEmailLayout(
      branding,
      {
        icon: sales ? '💬' : '💳',
        title: `New ${sales ? 'sales' : 'billing'} inquiry`,
        subtitle: `From ${input.name}`,
        categoryLabel: sales ? 'Sales inquiry' : 'Billing inquiry',
        preheader: `New ${input.topic} inquiry from ${input.name}`,
        footerHint: 'none',
      },
      `${paragraph('Someone submitted the public contact form. Reply directly to the sender below.')}
       ${detailTable(
         detailRow('👤', 'Name', escapeHtml(input.name)) +
           detailRow('📧', 'Email', `<a href="mailto:${escapeHtml(input.email)}" style="color:#4f46e5;">${escapeHtml(input.email)}</a>`) +
           (input.phone ? detailRow('📱', 'Phone', escapeHtml(input.phone)) : '') +
           (input.gymSlug ? detailRow('🏢', 'Gym', escapeHtml(input.gymSlug)) : '') +
           detailRow('🏷️', 'Topic', escapeHtml(sales ? 'Sales' : 'Billing')),
       )}
       ${sectionTitle('Message')}
       <div class="fc-soft" style="padding:16px 18px;border-radius:14px;background:#f7f8fc;border:1px solid #e6e8f0;border-left:4px solid #4f46e5;font-size:15px;line-height:1.7;color:#2b2f3b;">${textBlock(input.message)}</div>
       ${alertBox('info', null, 'The sender was promised a reply within one business day.')}`,
    ),
  };
}

/** Scheduled report delivery. The CSV body is shown inline (no attachment support yet). */
export function scheduledReportEmail(
  branding: EmailBranding,
  params: { scheduleName: string; reportType: string; frequency: string; branchName?: string | null; csv: string; filename: string },
) {
  const lines = params.csv.split(/\r?\n/).filter(Boolean);
  const shown = params.csv.slice(0, 4000);
  const truncated = params.csv.length > 4000;
  return {
    subject: `${params.scheduleName} — scheduled report (${params.frequency.toLowerCase()})`.replace(/[\r\n]+/g, ' '),
    html: renderEmailLayout(
      branding,
      {
        icon: '📊',
        title: 'Your report is ready',
        subtitle: params.scheduleName,
        categoryLabel: 'Scheduled report',
        preheader: `Your ${params.scheduleName} report is ready.`,
        footerHint: 'preferences',
      },
      `${paragraph(`Your scheduled report ${escapeHtml(params.scheduleName)} for ${escapeHtml(branding.tenantName)} has been generated.`)}
       ${detailTable(
         detailRow('📑', 'Report', escapeHtml(params.reportType)) +
           detailRow('🏢', 'Branch', escapeHtml(params.branchName ?? 'All branches')) +
           detailRow('🔁', 'Frequency', escapeHtml(params.frequency)) +
           detailRow('🧮', 'Rows (incl. header)', escapeHtml(lines.length)) +
           detailRow('📎', 'File name', escapeHtml(params.filename)),
       )}
       ${sectionTitle('Data')}
       <pre class="fc-soft" style="margin:0;padding:14px 16px;background:#f7f8fc;border:1px solid #e6e8f0;border-radius:12px;font-family:'SF Mono',Consolas,Menlo,monospace;font-size:11.5px;line-height:1.5;color:#2b2f3b;white-space:pre-wrap;word-break:break-word;">${escapeHtml(shown)}</pre>
       ${footnote(truncated ? 'Preview truncated at 4,000 characters — CSV attachments aren’t supported yet.' : 'CSV attachments aren’t supported yet, so the full data is shown inline.')}`,
    ),
  };
}
