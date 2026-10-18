import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../models/member_payment.dart';
import '../../../repositories/payment_repository.dart';
import '../../team/presentation/widgets/team_ui.dart';

/// Permission keys the Payments screens use. Each one is in
/// `apps/api/prisma/seed.ts` and equals the route's `requirePermission`:
/// `finance:view` (list / detail / analytics), `finance:payment-create`
/// (record, link, verify, cancel, resend), `finance:payment-refund`
/// (refund) and `finance:invoice-view` (the invoice screens).
class PayPerm {
  PayPerm._();

  static const view = 'finance:view';
  static const create = 'finance:payment-create';
  static const refund = 'finance:payment-refund';
  static const invoiceView = 'finance:invoice-view';
}

/// Web's "Verify status": `POST /payments/:id/verify`. For a PENDING online
/// payment this polls Razorpay and may flip it to SUCCESS / FAILED. Shows the
/// result (or the server's error) in a snackbar and returns the status, or
/// null when it failed.
Future<String?> verifyPaymentStatus(BuildContext context, String id) async {
  try {
    final status = await getIt<PaymentRepository>().verify(id);
    if (context.mounted) {
      teamSnack(context, 'Status verified: $status');
    }
    return status;
  } on ApiException catch (e) {
    if (context.mounted) teamSnack(context, e.detailedMessage, error: true);
  } catch (e) {
    if (context.mounted) {
      teamSnack(context, 'Could not verify the payment ($e)', error: true);
    }
  }
  return null;
}

/// Web's "Copy number".
Future<void> copyPaymentNumber(BuildContext context, MemberPayment p) async {
  await Clipboard.setData(ClipboardData(text: p.paymentNumber));
  if (context.mounted) teamSnack(context, 'Payment number copied.');
}
