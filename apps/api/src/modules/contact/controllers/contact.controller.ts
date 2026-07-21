import type { Request, Response } from 'express';

import { sendSuccess } from '../../../core/http/response';
import { enqueueEmail } from '../../../infrastructure/queue/email.queue';
import type { ContactRequestInput } from '../validators/contact.validators';

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

    const html = `
      <h2 style="margin:0 0 12px;">New ${input.topic} inquiry</h2>
      <table cellpadding="4" style="font-size:14px;">
        <tr><td><strong>Name</strong></td><td>${escapeHtml(input.name)}</td></tr>
        <tr><td><strong>Email</strong></td><td>${escapeHtml(input.email)}</td></tr>
        ${input.phone ? `<tr><td><strong>Phone</strong></td><td>${escapeHtml(input.phone)}</td></tr>` : ''}
        ${input.gymSlug ? `<tr><td><strong>Gym</strong></td><td>${escapeHtml(input.gymSlug)}</td></tr>` : ''}
      </table>
      <p style="white-space:pre-wrap;font-size:14px;border-left:3px solid #ccc;padding-left:12px;">${escapeHtml(input.message)}</p>`;

    await enqueueEmail({
      to: TOPIC_INBOX[input.topic],
      subject: `[${input.topic}] Inquiry from ${input.name}${input.gymSlug ? ` (${input.gymSlug})` : ''}`,
      html,
    });

    sendSuccess(res, null, "Thanks — we've received your message and will get back to you within one business day.", 201);
  }
}

export const contactController = new ContactController();
