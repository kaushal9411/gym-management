import type { Request, Response } from 'express';

import { env } from '../../../config/env';
import { sendSuccess } from '../../../core/http/response';
import { logger } from '../../../core/logging/logger';
import { contactInquiryEmail } from '../../../infrastructure/mail/templates/notification-templates';
import { enqueueEmail } from '../../../infrastructure/queue/email.queue';
import { adminLeadRepository } from '../../admin-leads/repositories/admin-lead.repository';
import { getPlatformBranding } from '../../admin-settings/services/platform-config.service';
import type { ContactRequestInput } from '../validators/contact.validators';

/** Internal inboxes per topic — dev mail lands in Mailpit like everything else. */
const TOPIC_INBOX: Record<ContactRequestInput['topic'], string> = {
  sales: 'sales@fitcloud.com',
  billing: 'billing@fitcloud.com',
  demo: 'sales@fitcloud.com',
  general: 'sales@fitcloud.com',
};

const THANKS = "Thanks — we've received your message and will get back to you within one business day.";

/**
 * Public "talk to sales / contact billing" intake, used by the website home
 * page and the expired-trial status screens. A mailto: link silently fails on
 * machines without a mail client, so the form posts here instead.
 *
 * Every real submission is stored as a `PlatformLead` (what the super-admin
 * "Leads" page lists) AND emailed to the team inbox. The lead is saved first:
 * if the mail queue is down the enquiry is still kept.
 */
export class ContactController {
  async submit(req: Request, res: Response): Promise<void> {
    const input = req.body as ContactRequestInput;

    // Honeypot: a person never sees this field. Pretend it worked, store nothing.
    if (input.website && input.website.trim().length > 0) {
      sendSuccess(res, null, THANKS, 201);
      return;
    }

    await adminLeadRepository.create({
      name: input.name,
      email: input.email,
      phone: input.phone ?? null,
      gymName: input.gymName ?? null,
      gymSlug: input.gymSlug ?? null,
      gymSize: input.gymSize ?? null,
      topic: input.topic.toUpperCase() as 'SALES' | 'BILLING' | 'DEMO' | 'GENERAL',
      message: input.message,
      source: input.source,
    });

    try {
      const mail = contactInquiryEmail(await getPlatformBranding(), input);
      // CONTACT_NOTIFY_EMAIL (when set) receives every topic; replying goes straight to the visitor.
      await enqueueEmail({ to: env.mail.contactNotifyEmail ?? TOPIC_INBOX[input.topic], replyTo: input.email, subject: mail.subject, html: mail.html });
    } catch (error) {
      // The lead is already saved and visible in the super-admin portal, so a mail hiccup must not fail the visitor's request.
      logger.warn('contact: lead saved but the notification email could not be queued', { error: error instanceof Error ? error.message : String(error) });
    }

    sendSuccess(res, null, THANKS, 201);
  }
}

export const contactController = new ContactController();
