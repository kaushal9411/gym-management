import type { Request, Response } from 'express';

import { AppError } from '../../../core/errors/app-error';
import { ErrorCode } from '../../../core/errors/error-codes';
import { sendSuccess } from '../../../core/http/response';
import { prisma } from '../../../infrastructure/database/prisma';
import { AdminTenantBillingService } from '../../admin-tenants/services/admin-tenant-billing.service';
import { MemberPaymentService } from '../services/member-payment.service';
import { verifyWebhookSignature } from '../services/razorpay-gateway.service';

type PaymentLinkOutcome = 'paid' | 'failed';

const PAID_EVENTS = new Set(['payment_link.paid']);
const FAILED_EVENTS = new Set(['payment_link.expired', 'payment_link.cancelled']);

interface RazorpayWebhookBody {
  event: string;
  payload: {
    payment_link?: { entity: { id: string; notes?: Record<string, string> | null } };
    payment?: { entity: { id: string } };
  };
}

/**
 * Real Razorpay webhook receiver for the Payment Link flows both
 * `AdminTenantBillingService` (platform billing — FitCloud↔tenant) and
 * `MemberPaymentService` (a gym↔its own member) use — a single endpoint
 * covers both since Razorpay's own event shape is identical either way; the
 * `notes` object each service stamps onto the link at creation time
 * (`platformPaymentId` vs `memberPaymentId`) is what tells them apart.
 * Configure in the Razorpay Dashboard (Settings → Webhooks): URL
 * `https://<api-host>/api/v1/webhook/razorpay-payment-link`, events
 * `payment_link.paid`, `payment_link.expired`, `payment_link.cancelled`,
 * secret in `RAZORPAY_WEBHOOK_SECRET`. Deliberately separate from the
 * sandboxed generic `/webhook/:provider` (`modules/webhook`) — that one's
 * payload is a normalized internal stand-in for a not-yet-real gateway
 * integration, this one verifies Razorpay's actual signature against
 * Razorpay's actual payload shape.
 *
 * Replaces the manual "Check status" poll as the primary path — both
 * services' `verifyPaymentStatus`/`verifyStatus` stay in place as a
 * fallback for a missed/delayed webhook delivery, not removed.
 */
export class RazorpayWebhookController {
  async handle(req: Request<Record<string, never>, unknown, RazorpayWebhookBody>, res: Response): Promise<void> {
    const signature = req.headers['x-razorpay-signature'] as string | undefined;
    const raw = req.rawBody ?? Buffer.from(JSON.stringify(req.body));
    if (!verifyWebhookSignature(raw, signature)) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'Invalid webhook signature.', 400);
    }

    const { event, payload } = req.body;
    const linkEntity = payload.payment_link?.entity;
    if (!linkEntity) {
      sendSuccess(res, { ignored: true }); // not a payment_link event — nothing this endpoint handles
      return;
    }

    const outcome: PaymentLinkOutcome | null = PAID_EVENTS.has(event) ? 'paid' : FAILED_EVENTS.has(event) ? 'failed' : null;
    if (!outcome) {
      sendSuccess(res, { ignored: true });
      return;
    }

    const notes = linkEntity.notes ?? {};
    const razorpayPaymentId = payload.payment?.entity.id;

    // Cross-tenant lookup by design — Razorpay has no notion of our tenant
    // subdomains, only the ids stamped into `notes` at link-creation time.
    // Same documented RLS caveat as the sandboxed webhook and onboarding's
    // assertNoDuplicate: this dev database's superuser role means RLS
    // doesn't actually block these reads; production needs a dedicated
    // platform-service DB role for this one legitimate cross-tenant case.
    if (notes.platformPaymentId) {
      const payment = await prisma.payment.findUnique({ where: { id: notes.platformPaymentId } });
      if (payment) {
        await new AdminTenantBillingService(payment.tenantId).applyWebhookOutcome(payment.id, outcome, razorpayPaymentId);
      }
    } else if (notes.memberPaymentId) {
      const payment = await prisma.memberPayment.findUnique({ where: { id: notes.memberPaymentId } });
      if (payment) {
        await new MemberPaymentService(payment.tenantId).applyWebhookOutcome(payment.id, outcome, razorpayPaymentId);
      }
    }

    sendSuccess(res, { received: true });
  }
}

export const razorpayWebhookController = new RazorpayWebhookController();
