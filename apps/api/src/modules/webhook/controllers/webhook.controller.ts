import type { Request, Response } from 'express';

import { AppError } from '../../../core/errors/app-error';
import { ErrorCode } from '../../../core/errors/error-codes';
import { eventBus } from '../../../core/events/event-bus';
import { sendSuccess } from '../../../core/http/response';
import { prisma } from '../../../infrastructure/database/prisma';
import { getTenantScopedClient } from '../../../infrastructure/database/tenant-scoped-client';
import { PaymentRepository } from '../../payment/repositories/payment.repository';
import { getPaymentGateway, type PaymentGatewayProvider } from '../../payment/services/payment-gateway.service';

const KNOWN_PROVIDERS: PaymentGatewayProvider[] = ['stripe', 'razorpay', 'paypal'];

interface WebhookBody {
  eventId: string;
  eventType: 'payment.succeeded' | 'payment.failed';
  paymentId: string;
}

/**
 * One endpoint per provider (`/webhook/stripe`, `/webhook/razorpay`,
 * `/webhook/paypal`) — this is where a real gateway calls back
 * asynchronously after a charge settles. The payload shape here
 * (`WebhookBody`) is a NORMALIZED internal contract, not any real gateway's
 * native payload — Stripe/Razorpay/PayPal each have wildly different
 * webhook shapes, and translating each one is exactly the work confined to
 * `payment-gateway.service.ts`'s per-provider adapters once real
 * credentials exist; nothing here needs to change when that happens.
 *
 * Real signature verification also needs the RAW, unparsed request body
 * (gateways sign the exact bytes sent) — this route would need
 * `express.raw({ type: 'application/json' })` ahead of the global JSON
 * parser to do that for real. The sandboxed `verifyWebhookSignature` only
 * checks that a signature header was present, so `JSON.stringify(req.body)`
 * is an honest stand-in, not a shortcut that would work against a real gateway.
 */
export class WebhookController {
  async handle(req: Request<{ provider: string }, unknown, WebhookBody>, res: Response): Promise<void> {
    const provider = req.params.provider as PaymentGatewayProvider;
    if (!KNOWN_PROVIDERS.includes(provider)) {
      throw new AppError(ErrorCode.NOT_FOUND, 'Unknown payment provider.', 404);
    }

    const signature = req.headers['x-webhook-signature'] as string | undefined;
    const gateway = getPaymentGateway(provider);
    const signatureValid = gateway.verifyWebhookSignature(JSON.stringify(req.body), signature);
    if (!signatureValid) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'Invalid webhook signature.', 400);
    }

    const { eventId, eventType, paymentId } = req.body;

    // Cross-tenant lookup by design — the gateway has no notion of our
    // tenant subdomains, only our internal paymentId. Same documented RLS
    // caveat as onboarding's assertNoDuplicate: this dev database's
    // superuser role means RLS doesn't actually block this read; a
    // production deployment's non-superuser app role would need a
    // dedicated platform-service role for this one legitimate cross-tenant
    // case, same as the subscription-lifecycle queue jobs.
    const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment) throw new AppError(ErrorCode.NOT_FOUND, 'Payment not found.', 404);

    const db = getTenantScopedClient(payment.tenantId);
    const paymentRepository = new PaymentRepository(db);

    const alreadyProcessed = await db.paymentTransaction.findFirst({
      where: { paymentId, rawPayload: { path: ['eventId'], equals: eventId } },
    });
    if (alreadyProcessed) {
      sendSuccess(res, { deduped: true });
      return;
    }

    await paymentRepository.recordTransaction({
      paymentId,
      provider: payment.provider,
      eventType,
      rawPayload: { eventId, eventType, paymentId },
      signatureValid,
    });

    if (eventType === 'payment.succeeded') {
      await paymentRepository.markResult(paymentId, { status: 'SUCCEEDED' });
      if (payment.invoiceId) await db.invoice.update({ where: { id: payment.invoiceId }, data: { status: 'PAID', paidAt: new Date() } });
      if (payment.subscriptionId) {
        await db.subscription.update({
          where: { id: payment.subscriptionId },
          data: { status: 'ACTIVE', graceEndsAt: null, suspendedAt: null },
        });
      }
      eventBus.emitEvent('billing.payment_succeeded', { tenantId: payment.tenantId, paymentId });
    } else {
      await paymentRepository.markResult(paymentId, { status: 'FAILED', failureReason: 'Reported failed by gateway webhook' });
      if (payment.subscriptionId) {
        await db.subscription.update({ where: { id: payment.subscriptionId }, data: { status: 'PAST_DUE' } });
      }
      eventBus.emitEvent('billing.payment_failed', { tenantId: payment.tenantId, paymentId });
    }

    sendSuccess(res, { received: true });
  }
}

export const webhookController = new WebhookController();
