import type { Request, Response } from 'express';

import { sendSuccess } from '../../../core/http/response';
import { PLATFORM_BRANDING } from '../../../infrastructure/mail/templates/base-layout';
import { contactInquiryEmail } from '../../../infrastructure/mail/templates/notification-templates';
import { enqueueEmail } from '../../../infrastructure/queue/email.queue';
import type { ContactRequestInput } from '../validators/contact.validators';

/** Internal inboxes per topic — dev mail lands in Mailpit like everything else. */
const TOPIC_INBOX: Record<ContactRequestInput['topic'], string> = {
  sales: 'sales@fitcloud.com',
  billing: 'billing@fitcloud.com',
};

/**
 * Public "talk to sales / contact billing" intake. A mailto: link silently
 * fails on machines without a mail client, so the status screens post here
 * instead and the platform's own queue delivers the message.
 */
export class ContactController {
  async submit(req: Request, res: Response): Promise<void> {
    const input = req.body as ContactRequestInput;

    const mail = contactInquiryEmail(PLATFORM_BRANDING, input);
    await enqueueEmail({ to: TOPIC_INBOX[input.topic], subject: mail.subject, html: mail.html });

    sendSuccess(res, null, "Thanks — we've received your message and will get back to you within one business day.", 201);
  }
}

export const contactController = new ContactController();
