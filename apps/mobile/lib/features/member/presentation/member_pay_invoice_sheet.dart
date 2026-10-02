import 'package:flutter/material.dart';
import 'package:razorpay_flutter/razorpay_flutter.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../repositories/member_portal_repository.dart';
import '../../../shared/widgets/app_button.dart';
import '../../../shared/widgets/app_state_views.dart';

/// Pays off a single outstanding invoice — mirrors [MemberRenewSheet]'s
/// Razorpay Orders + Checkout-modal round trip exactly, just against the
/// invoice's own `totalAmount` instead of a computed plan price. Settling
/// the invoice can also activate a still-PENDING membership on the
/// backend (`activatePendingMembershipIfAny`) — nothing special needed
/// here for that, it's a side effect of the same verify call. Pop with
/// `true` to tell the caller to refresh.
class MemberPayInvoiceSheet extends StatefulWidget {
  const MemberPayInvoiceSheet({
    required this.invoiceId,
    required this.invoiceNumber,
    required this.amount,
    super.key,
  });

  final String invoiceId;
  final String invoiceNumber;
  final double amount;

  @override
  State<MemberPayInvoiceSheet> createState() => _MemberPayInvoiceSheetState();
}

class _MemberPayInvoiceSheetState extends State<MemberPayInvoiceSheet> {
  final _razorpay = Razorpay();
  bool _submitting = false;
  bool _verifying = false;
  String? _error;

  /// Set while a Razorpay Order is open in the modal, so the success/error
  /// event handlers (which don't get the app's own paymentId back from
  /// Razorpay) know which backend `MemberPayment` row to verify against.
  String? _pendingPaymentId;

  @override
  void initState() {
    super.initState();
    _razorpay.on(Razorpay.EVENT_PAYMENT_SUCCESS, _handlePaymentSuccess);
    _razorpay.on(Razorpay.EVENT_PAYMENT_ERROR, _handlePaymentError);
  }

  @override
  void dispose() {
    _razorpay.clear();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      final result = await getIt<MemberPortalRepository>()
          .invoicePaymentCheckout(widget.invoiceId);
      if (!mounted) return;
      _pendingPaymentId = result.paymentId;
      _razorpay.open({
        'key': result.keyId,
        'amount': result.amount,
        'currency': result.currency,
        'order_id': result.orderId,
        'name': 'FitCloud',
        'description': 'Invoice ${widget.invoiceNumber}',
        'theme': {'color': '#16a34a'},
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  Future<void> _handlePaymentSuccess(PaymentSuccessResponse response) async {
    final paymentId = _pendingPaymentId;
    final orderId = response.orderId;
    final razorpayPaymentId = response.paymentId;
    final signature = response.signature;
    if (paymentId == null ||
        orderId == null ||
        razorpayPaymentId == null ||
        signature == null) {
      if (!mounted) return;
      setState(() => _error = 'Payment response was incomplete.');
      return;
    }
    setState(() {
      _verifying = true;
      _error = null;
    });
    try {
      final result =
          await getIt<MemberPortalRepository>().verifyInvoicePaymentCheckout(
        invoiceId: widget.invoiceId,
        paymentId: paymentId,
        razorpayOrderId: orderId,
        razorpayPaymentId: razorpayPaymentId,
        razorpaySignature: signature,
      );
      if (!mounted) return;
      if (result.status == 'SUCCESS') {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Invoice ${widget.invoiceNumber} paid.')),
        );
        Navigator.of(context).pop(true);
      } else {
        setState(
          () => _error = 'Payment verification failed. If you were '
              'charged, contact the front desk.',
        );
      }
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _verifying = false);
    }
  }

  void _handlePaymentError(PaymentFailureResponse response) {
    if (!mounted) return;
    setState(
      () => _error = response.code == Razorpay.PAYMENT_CANCELLED
          ? 'Checkout closed before payment completed.'
          : response.message ?? 'The payment failed. Please try again.',
    );
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom,
      ),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(18, 18, 18, 24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text('Pay ${widget.invoiceNumber}', style: AppText.display(size: 18)),
            const SizedBox(height: 2),
            Text(
              '₹${widget.amount.toStringAsFixed(0)} due',
              style: AppText.body(size: 13, color: AppColors.inkFaint),
            ),
            const SizedBox(height: 16),
            if (_error != null) ...[
              FormAlert(message: _error!),
              const SizedBox(height: 12),
            ],
            Text(
              "You'll pay in Razorpay's own secure checkout popup — this "
              'app never sees your card or UPI details.',
              style: AppText.body(size: 11, color: AppColors.inkFaint),
            ),
            const SizedBox(height: 18),
            AppButton(
              label: 'Pay now',
              role: AppRole.member,
              loading: _submitting || _verifying,
              onPressed: _submit,
            ),
          ],
        ),
      ),
    );
  }
}
