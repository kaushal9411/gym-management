import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:razorpay_flutter/razorpay_flutter.dart';

import '../../../bloc/platform/platform_config_cubit.dart';
import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/subscription_plan_option.dart';
import '../../../repositories/billing_repository.dart';
import '../../../shared/widgets/app_labeled_field.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../team/presentation/widgets/team_ui.dart';
import 'billing_ui.dart';

/// Accent per plan tier (cheapest first) — display only.
Color _accent(int sortOrder) => const [
      TeamColors.indigo,
      TeamColors.violet,
      TeamColors.fuchsia,
      TeamColors.teal,
    ][(sortOrder <= 0 ? 0 : sortOrder - 1) % 4];

/// web's yearly saving: only when both prices are real and the yearly price is
/// genuinely lower than 12 months of the monthly one.
int planYearlySavingPct(SubscriptionPlanOption plan) =>
    plan.priceYearly > 0 && plan.priceMonthly > 0
        ? ((1 - plan.priceYearly / (plan.priceMonthly * 12)) * 100).round()
        : 0;

/// "Change plan" — every plan a tenant can switch to, each card offering
/// Choose/Upgrade/Downgrade depending on [currentSortOrder]. Mirrors web's
/// `PlanComparison` (`features/billing/components/plan-comparison.tsx`)
/// feature-for-feature — Current-plan badge, price per month, "Save N% billed
/// yearly", the first 10 features (excluded ones struck through) — including
/// reusing the same `GET /onboarding/plans` endpoint (the wizard's
/// plan-selection step, not a dedicated one). 1 / 2 / 3 columns by width.
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
    setState(() => _error = null);
    try {
      final plans = await getIt<BillingRepository>().listPlans();
      if (!mounted) return;
      setState(() => _plans = plans);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    } catch (e) {
      if (!mounted) return;
      setState(
        () => _error = "Couldn't load plans. Please refresh and try again.",
      );
    }
  }

  Future<void> _openCheckout(SubscriptionPlanOption plan) async {
    final changed = await showTeamSheet<bool>(
      context,
      (_) => CheckoutSheet(
        targetPlan: plan,
        currentSortOrder: widget.currentSortOrder,
      ),
    );
    if (changed == true) widget.onChanged();
  }

  @override
  Widget build(BuildContext context) {
    final plans = _plans;
    if (plans == null) {
      if (_error != null) return _PlansError(message: _error!, onRetry: _load);
      return LayoutBuilder(
        builder: (context, c) => _grid(
          c.maxWidth,
          [
            for (var i = 0; i < 3; i++)
              Container(
                height: 220,
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(22),
                  border: Border.all(color: AppColors.line),
                ),
              ),
          ],
          equalHeight: false,
        ),
      );
    }
    return LayoutBuilder(
      builder: (context, c) => _grid(
        c.maxWidth,
        [
          for (final plan in plans)
            _PlanCard(
              key: ValueKey('plan-${plan.slug}'),
              plan: plan,
              isCurrent: plan.slug == widget.currentPlanSlug,
              currentSortOrder: widget.currentSortOrder,
              onSelect: () => _openCheckout(plan),
            ),
        ],
      ),
    );
  }

  Widget _grid(double width, List<Widget> cards, {bool equalHeight = true}) {
    final cols = width >= 900
        ? 3
        : width >= 560
            ? 2
            : 1;
    final rows = <Widget>[];
    for (var i = 0; i < cards.length; i += cols) {
      final slice = cards.sublist(i, (i + cols).clamp(0, cards.length));
      final stretch = equalHeight && cols > 1;
      final row = Row(
        crossAxisAlignment:
            stretch ? CrossAxisAlignment.stretch : CrossAxisAlignment.start,
        children: [
          for (var c = 0; c < cols; c++) ...[
            if (c > 0) const SizedBox(width: 12),
            Expanded(child: c < slice.length ? slice[c] : const SizedBox()),
          ],
        ],
      );
      rows.add(
        Padding(
          padding: EdgeInsets.only(top: i == 0 ? 0 : 14),
          child: stretch ? IntrinsicHeight(child: row) : row,
        ),
      );
    }
    return Column(children: rows);
  }
}

class _PlansError extends StatelessWidget {
  const _PlansError({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        FormAlert(message: message),
        const SizedBox(height: 8),
        TextButton(
          onPressed: onRetry,
          child: Text(
            'Retry',
            style: AppText.body(
              size: 13,
              weight: FontWeight.w800,
              color: TeamColors.violet,
            ),
          ),
        ),
      ],
    );
  }
}

class _PlanCard extends StatelessWidget {
  const _PlanCard({
    super.key,
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
    final color = _accent(plan.sortOrder);
    final isUpgrade =
        currentSortOrder == null || plan.sortOrder > currentSortOrder!;
    final saving = planYearlySavingPct(plan);
    final label = currentSortOrder == null
        ? 'Choose ${plan.name}'
        : '${isUpgrade ? 'Upgrade to' : 'Downgrade to'} ${plan.name}';

    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(
          color: isCurrent ? color : color.withValues(alpha: 0.25),
          width: isCurrent ? 2 : 1,
        ),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.fromLTRB(14, 14, 14, 12),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [
                  color.withValues(alpha: 0.22),
                  color.withValues(alpha: 0.03),
                ],
              ),
            ),
            child: Row(
              children: [
                Container(
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(12),
                    gradient: LinearGradient(
                      colors: [
                        color,
                        Color.lerp(color, TeamColors.fuchsia, 0.5)!,
                      ],
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: color.withValues(alpha: 0.4),
                        blurRadius: 10,
                        offset: const Offset(0, 4),
                      ),
                    ],
                  ),
                  child: const Icon(
                    Icons.workspace_premium_rounded,
                    size: 19,
                    color: Colors.white,
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    plan.name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: AppText.display(size: 18),
                  ),
                ),
                if (isCurrent)
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 4,
                    ),
                    decoration: BoxDecoration(
                      color: color,
                      borderRadius: BorderRadius.circular(99),
                    ),
                    child: Text(
                      'Current plan',
                      style: AppText.body(
                        size: 10.5,
                        weight: FontWeight.w800,
                        color: Colors.white,
                      ),
                    ),
                  ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 4, 14, 14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (plan.description.isNotEmpty)
                  Text(
                    plan.description,
                    style: AppText.body(
                      size: 12.5,
                      color: AppColors.inkFaint,
                      weight: FontWeight.w600,
                    ),
                  ),
                const SizedBox(height: 10),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.baseline,
                  textBaseline: TextBaseline.alphabetic,
                  children: [
                    Flexible(
                      child: Text(
                        billingMoney(plan.priceMonthly, plan.currency),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: AppText.display(size: 30, color: color),
                      ),
                    ),
                    const SizedBox(width: 5),
                    Text(
                      '/mo',
                      style: AppText.body(
                        size: 13,
                        color: AppColors.inkFaint,
                        weight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 2),
                if (saving > 0)
                  Text(
                    'Save $saving% billed yearly '
                    '(${billingMoney(plan.priceYearly, plan.currency)}/yr)',
                    style: AppText.body(
                      size: 12,
                      weight: FontWeight.w700,
                      color: TeamColors.green,
                    ),
                  )
                else
                  const SizedBox(height: 16),
                const SizedBox(height: 12),
                for (final f in plan.features.take(10))
                  Padding(
                    padding: const EdgeInsets.only(bottom: 7),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Padding(
                          padding: const EdgeInsets.only(top: 1),
                          child: Icon(
                            f.included
                                ? Icons.check_circle_rounded
                                : Icons.cancel_rounded,
                            size: 16,
                            color: f.included
                                ? TeamColors.green
                                : AppColors.inkFaint.withValues(alpha: 0.6),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            f.label,
                            style: AppText.body(
                              size: 13,
                              weight: FontWeight.w600,
                              color: f.included
                                  ? AppColors.ink
                                  : AppColors.inkFaint,
                            ).copyWith(
                              decoration: f.included
                                  ? null
                                  : TextDecoration.lineThrough,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                if (!isCurrent) ...[
                  const SizedBox(height: 8),
                  _PlanAction(
                    key: ValueKey('plan-action-${plan.slug}'),
                    label: label,
                    primary: isUpgrade,
                    onTap: onSelect,
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Plan card button: gradient for Choose / Upgrade, outlined for Downgrade;
/// the label ellipsizes so long plan names never overflow a narrow phone.
class _PlanAction extends StatelessWidget {
  const _PlanAction({
    super.key,
    required this.label,
    required this.primary,
    required this.onTap,
  });

  final String label;
  final bool primary;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final fg = primary ? Colors.white : AppColors.ink;
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(16),
          gradient: primary ? TeamColors.cta : null,
          color: primary ? null : AppColors.surface2,
          border: primary ? null : Border.all(color: AppColors.line),
          boxShadow: primary
              ? [
                  BoxShadow(
                    color: TeamColors.violet.withValues(alpha: 0.4),
                    blurRadius: 18,
                    offset: const Offset(0, 8),
                  ),
                ]
              : null,
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              primary
                  ? Icons.arrow_upward_rounded
                  : Icons.arrow_downward_rounded,
              size: 17,
              color: fg,
            ),
            const SizedBox(width: 6),
            Flexible(
              child: Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style:
                    AppText.body(size: 14, weight: FontWeight.w800, color: fg),
              ),
            ),
          ],
        ),
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
///
/// Opened with [showTeamSheet] (capped to 640 dp on tablets); pops `true`
/// once the plan is active. The money / plan logic is unchanged by the
/// redesign — only the layout and the added generic-error handling are new.
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

  String _money(double v) =>
      billingMoney(v, widget.targetPlan.currency, decimals: 2);

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
      setState(() => _error = e.detailedMessage);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = 'Could not check the coupon ($e)');
    } finally {
      if (mounted) setState(() => _applyingCoupon = false);
    }
  }

  Future<void> _submit() async {
    if (_submitting || _verifying) return;
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
        teamSnack(context, '${widget.targetPlan.name} plan is now active');
        Navigator.of(context).pop(true);
        return;
      }
      _pendingPaymentId = result.paymentId;
      _razorpay.open({
        'key': result.keyId,
        'amount': result.amount,
        'currency': result.currency,
        'order_id': result.orderId,
        'name': context.read<PlatformConfigCubit>().state.appName,
        'description':
            '${widget.targetPlan.name} plan (${_billingCycle.toLowerCase()})',
        'theme': {'color': '#16a34a'},
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.detailedMessage);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = 'Could not start checkout ($e)');
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
        teamSnack(context, '${widget.targetPlan.name} plan is now active');
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
      setState(() => _error = e.detailedMessage);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = 'Could not confirm the payment ($e)');
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
    final plan = widget.targetPlan;
    final busy = _submitting || _verifying;
    return Padding(
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom,
      ),
      child: ConstrainedBox(
        constraints: BoxConstraints(
          maxHeight: MediaQuery.of(context).size.height * 0.92,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            ClipRRect(
              borderRadius: const BorderRadius.vertical(
                top: Radius.circular(AppRadii.card),
              ),
              child: Container(
                padding: const EdgeInsets.fromLTRB(18, 18, 18, 16),
                decoration: const BoxDecoration(gradient: TeamColors.cta),
                child: Row(
                  children: [
                    Container(
                      width: 40,
                      height: 40,
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.2),
                        borderRadius: BorderRadius.circular(13),
                      ),
                      child: const Icon(
                        Icons.swap_horiz_rounded,
                        color: Colors.white,
                        size: 22,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Switch to ${plan.name}',
                            style: AppText.display(
                              size: 19,
                              color: Colors.white,
                            ),
                          ),
                          Text(
                            'Tax is calculated automatically from your '
                            'billing address.',
                            style: AppText.body(
                              size: 12,
                              weight: FontWeight.w600,
                              color: Colors.white.withValues(alpha: 0.88),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
            Flexible(
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(18, 16, 18, 24),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
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
                                key: ValueKey('cycle-$cycle'),
                                label:
                                    cycle == 'MONTHLY' ? 'Monthly' : 'Yearly',
                                selected: _billingCycle == cycle,
                                onTap: busy
                                    ? null
                                    : () => setState(() {
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
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: AppColors.surface,
                        borderRadius: BorderRadius.circular(AppRadii.field),
                        border: Border.all(color: AppColors.line),
                      ),
                      child: Column(
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Flexible(
                                child: Text(
                                  '${plan.name} (${_billingCycle.toLowerCase()})',
                                  style: AppText.body(size: 13.5),
                                ),
                              ),
                              Text(
                                _money(_basePrice),
                                key: const ValueKey('checkout-base'),
                                style: AppText.tabular(
                                  size: 14,
                                  weight: FontWeight.w800,
                                  color: _discountedAmount != null
                                      ? AppColors.inkFaint
                                      : AppColors.ink,
                                ).copyWith(
                                  decoration: _discountedAmount != null
                                      ? TextDecoration.lineThrough
                                      : null,
                                ),
                              ),
                            ],
                          ),
                          if (_discountedAmount != null) ...[
                            const SizedBox(height: 6),
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text(
                                  'After coupon',
                                  style: AppText.body(
                                    size: 12.5,
                                    weight: FontWeight.w700,
                                    color: TeamColors.green,
                                  ),
                                ),
                                Text(
                                  _money(_discountedAmount!),
                                  key: const ValueKey('checkout-discounted'),
                                  style: AppText.tabular(
                                    size: 14,
                                    weight: FontWeight.w800,
                                    color: TeamColors.green,
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
                            icon: Icons.local_offer_rounded,
                            iconColor: TeamColors.amber,
                            controller: _couponController,
                            onChanged: (_) => setState(() {}),
                            textCapitalization: TextCapitalization.characters,
                          ),
                        ),
                        const SizedBox(width: 10),
                        SizedBox(
                          width: 92,
                          child: TeamOutlineButton(
                            key: const ValueKey('coupon-apply'),
                            label: _applyingCoupon ? 'Checking…' : 'Apply',
                            onTap: _applyingCoupon ||
                                    busy ||
                                    _couponController.text.trim().isEmpty
                                ? null
                                : _applyCoupon,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Text(
                      _discountedAmount == 0
                          ? 'This coupon covers the full amount — no payment '
                              'needed.'
                          : "You'll pay in Razorpay's own secure checkout "
                              'popup — this app never sees your card or UPI '
                              'details.',
                      style: AppText.body(
                        size: 11.5,
                        color: AppColors.inkFaint,
                        weight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 18),
                    TeamGradientButton(
                      key: const ValueKey('checkout-confirm'),
                      label: 'Confirm '
                          '${_kind == 'upgrade' ? 'upgrade' : _kind == 'downgrade' ? 'downgrade' : 'plan'}',
                      icon: Icons.lock_rounded,
                      loading: busy,
                      onTap: _submit,
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _CycleButton extends StatelessWidget {
  const _CycleButton({
    super.key,
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(AppRadii.pill),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 9),
          decoration: BoxDecoration(
            color: selected ? AppColors.surface : null,
            borderRadius: BorderRadius.circular(AppRadii.pill),
          ),
          child: Text(
            label,
            style: AppText.body(
              size: 12.5,
              weight: FontWeight.w800,
              color: selected ? TeamColors.violet : AppColors.inkFaint,
            ),
          ),
        ),
      ),
    );
  }
}
