import 'package:flutter/material.dart';
import 'package:razorpay_flutter/razorpay_flutter.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../repositories/member_portal_repository.dart';
import '../../../shared/widgets/app_button.dart';
import '../../../shared/widgets/app_state_views.dart';

/// Renews the member's CURRENT plan only (no self-service upgrade/downgrade
/// — a staff-only, separate feature), and only once it has actually
/// expired — same rule the staff-side Renew action enforces. Mirrors
/// `features/billing/presentation/plan_comparison.dart`'s `CheckoutSheet`
/// exactly, just without a plan picker or coupon field (one plan, one
/// price, computed server-side). Pop with `true` to tell the caller to
/// refresh (the dashboard's membership card).
class MemberRenewSheet extends StatefulWidget {
  const MemberRenewSheet({required this.planName, super.key});

  final String planName;

  @override
  State<MemberRenewSheet> createState() => _MemberRenewSheetState();
}

class _MemberRenewSheetState extends State<MemberRenewSheet> {
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
      final result =
          await getIt<MemberPortalRepository>().renewCheckout();
      if (!mounted) return;
      if (!result.requiresPayment) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Your membership has been renewed.')),
        );
        Navigator.of(context).pop(true);
        return;
      }
      _pendingPaymentId = result.paymentId;
      _razorpay.open({
        'key': result.keyId,
        'amount': result.amount,
        'currency': result.currency,
        'order_id': result.orderId,
        'name': 'FitCloud',
        'description': '${widget.planName} plan renewal',
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
      final result = await getIt<MemberPortalRepository>().verifyRenewCheckout(
        paymentId: paymentId,
        razorpayOrderId: orderId,
        razorpayPaymentId: razorpayPaymentId,
        razorpaySignature: signature,
      );
      if (!mounted) return;
      if (result.status == 'SUCCESS') {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Your membership has been renewed.')),
        );
        Navigator.of(context).pop(true);
      } else {
        setState(
          () => _error = 'Payment verification failed. If you were charged, '
              'contact the front desk — your membership has not been renewed.',
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
          ? 'Checkout closed before payment completed. Your membership has '
              'not been renewed — try again when ready.'
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
            Text('Renew ${widget.planName}', style: AppText.display(size: 18)),
            const SizedBox(height: 2),
            Text(
              'Renewing starts a fresh period from today at this plan\'s '
              'current price.',
              style: AppText.body(size: 12, color: AppColors.inkFaint),
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
              label: 'Renew & Pay',
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
