import type { Request, Response } from 'express';

import { sendSuccess } from '../../../core/http/response';
import { detailRow, detailTable, renderEmailLayout } from '../../../infrastructure/mail/templates/base-layout';
import { enqueueEmail } from '../../../infrastructure/queue/email.queue';
import type { ContactRequestInput } from '../validators/contact.validators';

const PLATFORM_BRANDING = { tenantName: 'FitCloud' };

/** Internal inboxes per topic — dev mail lands in Mailpit like everything else. */
const TOPIC_INBOX: Record<ContactRequestInput['topic'], string> = {
  sales: 'sales@fitcloud.com',
  billing: 'billing@fitcloud.com',
};

const escapeHtml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * Public "talk to sales / contact billing" intake. A mailto: link silently
 * fails on machines without a mail client, so the status screens post here
 * instead and the platform's own queue delivers the message.
 */
export class ContactController {
  async submit(req: Request, res: Response): Promise<void> {
    const input = req.body as ContactRequestInput;

    const html = renderEmailLayout(
      PLATFORM_BRANDING,
      {
        icon: input.topic === 'sales' ? '💬' : '💳',
        title: `New ${input.topic === 'sales' ? 'Sales' : 'Billing'} Inquiry`,
        categoryLabel: input.topic === 'sales' ? 'Sales inquiry' : 'Billing inquiry',
        preheader: `New ${input.topic} inquiry from ${input.name}`,
      },
      `${detailTable(
        detailRow('👤', 'Name', escapeHtml(input.name)) +
          detailRow('📧', 'Email', escapeHtml(input.email)) +
          (input.phone ? detailRow('📱', 'Phone', escapeHtml(input.phone)) : '') +
          (input.gymSlug ? detailRow('🏢', 'Gym', escapeHtml(input.gymSlug)) : ''),
      )}
       <p style="white-space:pre-wrap;margin-top:20px;padding-left:14px;border-left:3px solid #e5e7eb;color:#374151;">${escapeHtml(input.message)}</p>`,
    );

    await enqueueEmail({
      to: TOPIC_INBOX[input.topic],
      subject: `[${input.topic}] Inquiry from ${input.name}${input.gymSlug ? ` (${input.gymSlug})` : ''}`,
      html,
    });

    sendSuccess(res, null, "Thanks — we've received your message and will get back to you within one business day.", 201);
  }
}

export const contactController = new ContactController();
