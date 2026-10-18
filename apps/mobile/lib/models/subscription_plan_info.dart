import 'payments_analytics.dart' show jsonInt, jsonMoney;

class SubscriptionPlanInfo {
  const SubscriptionPlanInfo({
    required this.slug,
    required this.name,
    required this.sortOrder,
    required this.priceMonthly,
    required this.priceYearly,
    required this.currency,
    required this.maxBranches,
    required this.maxStaff,
    required this.maxMembers,
    this.description = '',
  });

  final String slug;
  final String name;

  /// Short marketing blurb shown under the plan name on the Billing overview
  /// (web's `PanelCard subtitle`). Empty when the API sends none.
  final String description;

  /// Plan tier ordering (1 = cheapest) — used to tell an upgrade from a
  /// downgrade when switching plans (`PlanComparisonList`).
  final int sortOrder;
  final double priceMonthly;
  final double priceYearly;
  final String currency;
  final int maxBranches;
  final int maxStaff;
  final int maxMembers;

  /// Prices arrive as decimal strings (`"1499.00"`), limits as ints — both
  /// parsed defensively so one odd value can't blank the whole screen.
  factory SubscriptionPlanInfo.fromJson(Map<String, dynamic> json) =>
      SubscriptionPlanInfo(
        slug: json['slug'] as String,
        name: json['name'] as String,
        description: json['description'] as String? ?? '',
        sortOrder: jsonInt(json['sortOrder']),
        priceMonthly: jsonMoney(json['priceMonthly']),
        priceYearly: jsonMoney(json['priceYearly']),
        currency: json['currency'] as String? ?? 'INR',
        maxBranches: jsonInt(json['maxBranches']),
        maxStaff: jsonInt(json['maxStaff']),
        maxMembers: jsonInt(json['maxMembers']),
      );
}

/// Mirrors the raw `Subscription` row (+ nested `plan`) returned by
/// `GET /subscription`. A tenant provisioned outside the normal onboarding
/// wizard may have none at all — a 404 `NOT_FOUND`, not a bug.
class TenantSubscription {
  const TenantSubscription({
    required this.status,
    required this.billingCycle,
    required this.trialEndsAt,
    required this.currentPeriodStart,
    required this.currentPeriodEnd,
    required this.cancelAtPeriodEnd,
    required this.plan,
    this.graceEndsAt,
  });

  final String status;
  final String billingCycle;
  final DateTime? trialEndsAt;
  final DateTime currentPeriodStart;
  final DateTime? currentPeriodEnd;
  final bool cancelAtPeriodEnd;

  /// End of the payment grace window (`GRACE` / `PAST_DUE`); null otherwise.
  final DateTime? graceEndsAt;
  final SubscriptionPlanInfo plan;

  /// web's `isCancellable` — anything not already ended.
  bool get isCancellable => status != 'CANCELED' && status != 'EXPIRED';

  bool get isYearly => billingCycle == 'YEARLY';

  /// The recurring price of the current cycle (web derives "Next amount" the
  /// same way — the subscription has no amount field of its own).
  double get cyclePrice => isYearly ? plan.priceYearly : plan.priceMonthly;

  factory TenantSubscription.fromJson(Map<String, dynamic> json) =>
      TenantSubscription(
        status: json['status'] as String,
        billingCycle: json['billingCycle'] as String,
        trialEndsAt: _date(json['trialEndsAt']),
        currentPeriodStart:
            DateTime.parse(json['currentPeriodStart'] as String),
        currentPeriodEnd: _date(json['currentPeriodEnd']),
        graceEndsAt: _date(json['graceEndsAt']),
        cancelAtPeriodEnd: json['cancelAtPeriodEnd'] as bool? ?? false,
        plan: SubscriptionPlanInfo.fromJson(
          json['plan'] as Map<String, dynamic>,
        ),
      );

  static DateTime? _date(Object? v) =>
      v is String ? DateTime.tryParse(v) : null;
}
