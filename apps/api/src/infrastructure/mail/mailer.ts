import nodemailer, { type Transporter } from 'nodemailer';

import { logger } from '../../core/logging/logger';
import { platformNotificationCredentialService, type ResolvedSmtpConfig } from '../../modules/admin-notification-settings/services/platform-notification-credential.service';

import { htmlToText } from './templates/base-layout';

export interface SendMailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
  fromName?: string;
  fromAddress?: string;
}

/**
 * Thin Nodemailer wrapper. In development this points at Mailpit
 * (docker-compose service, UI at http://localhost:8025) — no real email
 * ever leaves the machine. Swapping to SES in production is a transport
 * config change only; callers never change.
 *
 * Credentials come from `PlatformNotificationCredentialService#resolveSmtpConfig`
 * (a super-admin-editable DB row, falling back to `.env`'s `SMTP_*`),
 * resolved fresh on every `send()` rather than once at module load — so a
 * credential update from the admin settings page takes effect on the very
 * next email with no restart. The pooled transport itself is still cached
 * and reused across sends (this is why pooling existed in the first
 * place — a burst of emails shouldn't pay a fresh TLS handshake each time),
 * just rebuilt whenever the resolved config actually differs from what it
 * was last built from.
 */
class Mailer {
  private transporter: Transporter | null = null;
  private transporterSignature: string | null = null;

  private getTransporter(config: ResolvedSmtpConfig): Transporter {
    const signature = JSON.stringify(config);

    if (this.transporter && this.transporterSignature === signature) {
      return this.transporter;
    }

    this.transporter = nodemailer.createTransport({
      // Pooled: reuses SMTP connections, so bursts (e.g. a broadcast) pay the handshake once, not per message.
      pool: true,
      maxConnections: 2,
      host: config.host,
      port: config.port,
      secure: config.secure,
      // When not using implicit TLS (dev/Mailpit), also skip opportunistic
      // STARTTLS — Mailpit's plain-SMTP listener doesn't speak it, and
      // nodemailer's auto-upgrade attempt otherwise fails with a raw SSL
      // handshake error ("wrong version number") instead of sending the mail.
      ignoreTLS: !config.secure,
      auth: config.user ? { user: config.user, pass: config.pass } : undefined,
    });
    this.transporterSignature = signature;
    return this.transporter;
  }

  async send(input: SendMailInput): Promise<void> {
    const config = await platformNotificationCredentialService.resolveSmtpConfig();
    const transporter = this.getTransporter(config);
    const fromName = input.fromName ?? config.fromName;
    const fromAddress = input.fromAddress ?? config.fromAddress;

    await transporter.sendMail({
      from: `"${fromName}" <${fromAddress}>`,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text ?? htmlToText(input.html),
    });

    logger.info('Email sent', { to: input.to, subject: input.subject });
  }
}

export const mailer = new Mailer();
