import 'package:flutter/material.dart';
import 'package:razorpay_flutter/razorpay_flutter.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/subscription_plan_option.dart';
import '../../../repositories/billing_repository.dart';
import '../../../shared/widgets/app_button.dart';
import '../../../shared/widgets/app_labeled_field.dart';
import '../../../shared/widgets/app_pill.dart';
import '../../../shared/widgets/app_state_views.dart';

String _formatMoney(double amount, String currency) =>
    '$currency ${amount.toStringAsFixed(0)}';

/// "Change plan" — every plan a tenant can switch to, each row offering
/// Choose/Upgrade/Downgrade depending on [currentSortOrder]. Mirrors web's
/// `PlanComparison` (`features/billing/components/plan-comparison.tsx`)
/// feature-for-feature, including reusing the same `GET /onboarding/plans`
/// endpoint (the wizard's plan-selection step, not a dedicated one).
class PlanComparisonList extends StatefulWidget {
  const PlanComparisonList({
    required this.currentPlanSlug,
    required this.currentSortOrder,
    required this.onChanged,
    super.key,
  });

  final String? currentPlanSlug;
  final int? currentSortOrder;
  final VoidCallback onChanged;

  @override
  State<PlanComparisonList> createState() => _PlanComparisonListState();
}

class _PlanComparisonListState extends State<PlanComparisonList> {
  List<SubscriptionPlanOption>? _plans;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final plans = await getIt<BillingRepository>().listPlans();
      if (!mounted) return;
      setState(() => _plans = plans);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    }
  }

  Future<void> _openCheckout(SubscriptionPlanOption plan) async {
    final changed = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (_) => CheckoutSheet(
        targetPlan: plan,
        currentSortOrder: widget.currentSortOrder,
      ),
    );
    if (changed == true) widget.onChanged();
  }

  @override
  Widget build(BuildContext context) {
    if (_plans == null) {
      return _error != null
          ? AppErrorView(message: _error!, onRetry: _load)
          : const AppLoadingView();
    }
    return Column(
      children: [
        for (final plan in _plans!) ...[
          _PlanCard(
            plan: plan,
            isCurrent: plan.slug == widget.currentPlanSlug,
            currentSortOrder: widget.currentSortOrder,
            onSelect: () => _openCheckout(plan),
          ),
          const SizedBox(height: 10),
        ],
      ],
    );
  }
}

class _PlanCard extends StatelessWidget {
  const _PlanCard({
    required this.plan,
    required this.isCurrent,
    required this.currentSortOrder,
    required this.onSelect,
  });

  final SubscriptionPlanOption plan;
  final bool isCurrent;
  final int? currentSortOrder;
  final VoidCallback onSelect;

  @override
  Widget build(BuildContext context) {
    final included = plan.features.where((f) => f.included).take(6).toList();
    final isUpgrade =
        currentSortOrder == null || plan.sortOrder > currentSortOrder!;

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface2,
        borderRadius: BorderRadius.circular(AppRadii.card),
        border: Border.all(
          color: isCurrent ? AppColors.staffPillFg : AppColors.line,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Text(
                          plan.name,
                          style: AppText.body(
                            size: 15,
                            weight: FontWeight.w800,
                          ),
                        ),
                        if (isCurrent) ...[
                          const SizedBox(width: 8),
                          const AppPill(
                            label: 'Current plan',
                            tone: AppPillTone.roleTint,
                          ),
                        ],
                      ],
                    ),
                    const SizedBox(height: 2),
                    Text(
                      plan.description,
                      style: AppText.body(size: 11, color: AppColors.inkFaint),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                    _formatMoney(plan.priceMonthly, plan.currency),
                    style: AppText.tabular(size: 15, weight: FontWeight.w800),
                  ),
                  Text(
                    '/mo',
                    style: AppText.body(size: 10, color: AppColors.inkFaint),
                  ),
                ],
              ),
            ],
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 10,
            runSpacing: 4,
            children: [
              for (final feature in included)
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(
                      Icons.check_rounded,
                      size: 12,
                      color: AppColors.success,
                    ),
                    const SizedBox(width: 3),
                    Text(
                      feature.label,
                      style: AppText.body(
                        size: 11,
                        color: AppColors.inkFaint,
                      ),
                    ),
                  ],
                ),
            ],
          ),
          if (!isCurrent) ...[
            const SizedBox(height: 10),
            AppButton(
              label: currentSortOrder == null
                  ? 'Choose ${plan.name}'
                  : '${isUpgrade ? 'Upgrade' : 'Downgrade'} to ${plan.name}',
              variant: isUpgrade
                  ? AppButtonVariant.roleGradient
                  : AppButtonVariant.ghost,
              size: AppButtonSize.small,
              onPressed: onSelect,
            ),
          ],
        ],
      ),
    );
  }
}

/// Choose plan → apply coupon → tax (server-side) → real Razorpay Order →
/// invoice → activate, in one sheet — mirrors web's `CheckoutDialog`. A
/// free/fully-discounted result activates immediately; anything with a
/// balance due opens Razorpay's own native Checkout modal
/// (`razorpay_flutter`, in-app — this app never collects card/UPI details
/// itself), and the modal's signed success callback is verified
/// server-side (HMAC of order+payment ids) before the plan activates.
class CheckoutSheet extends StatefulWidget {
  const CheckoutSheet({
    required this.targetPlan,
    required this.currentSortOrder,
    super.key,
  });

  final SubscriptionPlanOption targetPlan;
  final int? currentSortOrder;

  @override
  State<CheckoutSheet> createState() => _CheckoutSheetState();
}

class _CheckoutSheetState extends State<CheckoutSheet> {
  final _couponController = TextEditingController();
  final _razorpay = Razorpay();
  String _billingCycle = 'MONTHLY';
  double? _discountedAmount;
  bool _applyingCoupon = false;
  bool _submitting = false;
  bool _verifying = false;
  String? _error;

  /// Set while a Razorpay Order is open in the modal, so the success/error
  /// event handlers (which don't get the app's own paymentId back from
  /// Razorpay) know which backend `Payment` row to verify against.
  String? _pendingPaymentId;

  @override
  void initState() {
    super.initState();
    _razorpay.on(Razorpay.EVENT_PAYMENT_SUCCESS, _handlePaymentSuccess);
    _razorpay.on(Razorpay.EVENT_PAYMENT_ERROR, _handlePaymentError);
  }

  @override
  void dispose() {
    _couponController.dispose();
    _razorpay.clear();
    super.dispose();
  }

  double get _basePrice => _billingCycle == 'YEARLY'
      ? widget.targetPlan.priceYearly
      : widget.targetPlan.priceMonthly;

  String get _kind => widget.currentSortOrder == null
      ? 'create'
      : widget.targetPlan.sortOrder > widget.currentSortOrder!
          ? 'upgrade'
          : 'downgrade';

  Future<void> _applyCoupon() async {
    final code = _couponController.text.trim();
    if (code.isEmpty) return;
    setState(() {
      _applyingCoupon = true;
      _error = null;
    });
    try {
      final amount =
          await getIt<BillingRepository>().validateCoupon(code, _basePrice);
      if (!mounted) return;
      setState(() => _discountedAmount = amount);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _applyingCoupon = false);
    }
  }

  Future<void> _submit() async {
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      final result = await getIt<BillingRepository>().checkout(
        kind: _kind,
        planSlug: widget.targetPlan.slug,
        billingCycle: _billingCycle,
        couponCode: _couponController.text.trim(),
      );
      if (!mounted) return;
      if (!result.requiresPayment) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('${widget.targetPlan.name} plan is now active'),
          ),
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
        'description':
            '${widget.targetPlan.name} plan (${_billingCycle.toLowerCase()})',
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
      final result = await getIt<BillingRepository>().verifyCheckout(
        paymentId: paymentId,
        razorpayOrderId: orderId,
        razorpayPaymentId: razorpayPaymentId,
        razorpaySignature: signature,
      );
      if (!mounted) return;
      if (result.status == 'SUCCEEDED') {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('${widget.targetPlan.name} plan is now active'),
          ),
        );
        Navigator.of(context).pop(true);
      } else {
        setState(
          () => _error =
              'Payment verification failed. If you were charged, contact '
                  'support — your plan has not changed.',
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
          ? 'Checkout closed before payment completed. Your plan has not '
              'changed — try again when ready.'
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
        child: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                'Switch to ${widget.targetPlan.name}',
                style: AppText.display(size: 18),
              ),
              const SizedBox(height: 2),
              Text(
                'Tax is calculated automatically from your billing address.',
                style: AppText.body(size: 12, color: AppColors.inkFaint),
              ),
              const SizedBox(height: 16),
              if (_error != null) ...[
                FormAlert(message: _error!),
                const SizedBox(height: 12),
              ],
              Center(
                child: Container(
                  padding: const EdgeInsets.all(3),
                  decoration: BoxDecoration(
                    color: AppColors.surface3,
                    borderRadius: BorderRadius.circular(AppRadii.pill),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      for (final cycle in ['MONTHLY', 'YEARLY'])
                        _CycleButton(
                          label: cycle == 'MONTHLY' ? 'Monthly' : 'Yearly',
                          selected: _billingCycle == cycle,
                          onTap: () => setState(() {
                            _billingCycle = cycle;
                            _discountedAmount = null;
                          }),
                        ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 14),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppColors.surface2,
                  borderRadius: BorderRadius.circular(AppRadii.field),
                  border: Border.all(color: AppColors.line),
                ),
                child: Column(
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          '${widget.targetPlan.name} (${_billingCycle.toLowerCase()})',
                          style: AppText.body(size: 13),
                        ),
                        Text(
                          _formatMoney(
                            _basePrice,
                            widget.targetPlan.currency,
                          ),
                          style: AppText.tabular(
                            size: 13,
                            weight: FontWeight.w700,
                            color: _discountedAmount != null
                                ? AppColors.inkFaint
                                : AppColors.ink,
                          ),
                        ),
                      ],
                    ),
                    if (_discountedAmount != null) ...[
                      const SizedBox(height: 4),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            'After coupon',
                            style: AppText.body(
                              size: 12,
                              color: AppColors.success,
                            ),
                          ),
                          Text(
                            _formatMoney(
                              _discountedAmount!,
                              widget.targetPlan.currency,
                            ),
                            style: AppText.tabular(
                              size: 13,
                              weight: FontWeight.w700,
                              color: AppColors.success,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(height: 14),
              Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Expanded(
                    child: AppLabeledField(
                      label: 'Coupon code (optional)',
                      hintText: 'SAVE20',
                      controller: _couponController,
                      textCapitalization: TextCapitalization.characters,
                    ),
                  ),
                  const SizedBox(width: 10),
                  AppButton(
                    label: 'Apply',
                    variant: AppButtonVariant.ghost,
                    size: AppButtonSize.small,
                    fullWidth: false,
                    loading: _applyingCoupon,
                    onPressed: _applyCoupon,
                  ),
                ],
              ),
              const SizedBox(height: 6),
              Text(
                _discountedAmount == 0
                    ? 'This coupon covers the full amount — no payment '
                        'needed.'
                    : "You'll pay in Razorpay's own secure checkout popup "
                        '— this app never sees your card or UPI details.',
                style: AppText.body(size: 11, color: AppColors.inkFaint),
              ),
              const SizedBox(height: 18),
              AppButton(
                label: 'Confirm '
                    '${_kind == 'upgrade' ? 'upgrade' : _kind == 'downgrade' ? 'downgrade' : 'plan'}',
                loading: _submitting || _verifying,
                onPressed: _submit,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _CycleButton extends StatelessWidget {
  const _CycleButton({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(AppRadii.pill),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          decoration: BoxDecoration(
            color: selected ? AppColors.surface : null,
            borderRadius: BorderRadius.circular(AppRadii.pill),
          ),
          child: Text(
            label,
            style: AppText.body(
              size: 12,
              weight: FontWeight.w700,
              color: selected ? AppColors.ink : AppColors.inkFaint,
            ),
          ),
        ),
      ),
    );
  }
}
