import nodemailer, { type Transporter } from 'nodemailer';

import { env } from '../../config/env';
import { logger } from '../../core/logging/logger';

export interface SendMailInput {
  to: string;
  subject: string;
  html: string;
  fromName?: string;
  fromAddress?: string;
}

/**
 * Thin Nodemailer wrapper. In development this points at Mailpit
 * (docker-compose service, UI at http://localhost:8025) — no real email
 * ever leaves the machine. Swapping to SES in production is a transport
 * config change only; callers never change.
 */
class Mailer {
  private transporter: Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: env.mail.host,
      port: env.mail.port,
      secure: env.mail.secure,
      // When not using implicit TLS (dev/Mailpit), also skip opportunistic
      // STARTTLS — Mailpit's plain-SMTP listener doesn't speak it, and
      // nodemailer's auto-upgrade attempt otherwise fails with a raw SSL
      // handshake error ("wrong version number") instead of sending the mail.
      ignoreTLS: !env.mail.secure,
      auth: env.mail.user ? { user: env.mail.user, pass: env.mail.pass } : undefined,
    });
  }

  async send(input: SendMailInput): Promise<void> {
    const fromName = input.fromName ?? env.mail.fromName;
    const fromAddress = input.fromAddress ?? env.mail.fromAddress;

    await this.transporter.sendMail({
      from: `"${fromName}" <${fromAddress}>`,
      to: input.to,
      subject: input.subject,
      html: input.html,
    });

    logger.info('Email sent', { to: input.to, subject: input.subject });
  }
}

export const mailer = new Mailer();
