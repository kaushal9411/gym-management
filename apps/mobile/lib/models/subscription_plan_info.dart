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
  });

  final String slug;
  final String name;

  /// Plan tier ordering (1 = cheapest) — used to tell an upgrade from a
  /// downgrade when switching plans (`PlanComparisonList`).
  final int sortOrder;
  final double priceMonthly;
  final double priceYearly;
  final String currency;
  final int maxBranches;
  final int maxStaff;
  final int maxMembers;

  factory SubscriptionPlanInfo.fromJson(Map<String, dynamic> json) =>
      SubscriptionPlanInfo(
        slug: json['slug'] as String,
        name: json['name'] as String,
        sortOrder: json['sortOrder'] as int,
        priceMonthly: double.parse(json['priceMonthly'] as String),
        priceYearly: double.parse(json['priceYearly'] as String),
        currency: json['currency'] as String,
        maxBranches: json['maxBranches'] as int,
        maxStaff: json['maxStaff'] as int,
        maxMembers: json['maxMembers'] as int,
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
  });

  final String status;
  final String billingCycle;
  final DateTime? trialEndsAt;
  final DateTime currentPeriodStart;
  final DateTime? currentPeriodEnd;
  final bool cancelAtPeriodEnd;
  final SubscriptionPlanInfo plan;

  factory TenantSubscription.fromJson(Map<String, dynamic> json) =>
      TenantSubscription(
        status: json['status'] as String,
        billingCycle: json['billingCycle'] as String,
        trialEndsAt: json['trialEndsAt'] == null
            ? null
            : DateTime.parse(json['trialEndsAt'] as String),
        currentPeriodStart:
            DateTime.parse(json['currentPeriodStart'] as String),
        currentPeriodEnd: json['currentPeriodEnd'] == null
            ? null
            : DateTime.parse(json['currentPeriodEnd'] as String),
        cancelAtPeriodEnd: json['cancelAtPeriodEnd'] as bool? ?? false,
        plan: SubscriptionPlanInfo.fromJson(
          json['plan'] as Map<String, dynamic>,
        ),
      );
}
