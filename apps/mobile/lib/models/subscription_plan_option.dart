/// One module toggle within a plan (`GET /onboarding/plans`'s `features[]`)
/// — reused here for the "Change plan" comparison (`PlanComparison` on
/// web), a different endpoint/shape from [SubscriptionPlanInfo] (the
/// flatter projection nested on `GET /subscription`).
class PlanFeature {
  const PlanFeature({
    required this.key,
    required this.label,
    required this.included,
  });

  final String key;
  final String label;
  final bool included;

  factory PlanFeature.fromJson(Map<String, dynamic> json) => PlanFeature(
        key: json['key'] as String,
        label: json['label'] as String,
        included: json['included'] as bool,
      );
}

class PlanLimits {
  const PlanLimits({
    required this.maxBranches,
    required this.maxManagers,
    required this.maxTrainers,
    required this.maxReceptionists,
    required this.maxStaff,
    required this.maxMembers,
    required this.maxStorageMb,
  });

  final int maxBranches;
  final int maxManagers;
  final int maxTrainers;
  final int maxReceptionists;
  final int maxStaff;
  final int maxMembers;
  final int maxStorageMb;

  factory PlanLimits.fromJson(Map<String, dynamic> json) => PlanLimits(
        maxBranches: json['maxBranches'] as int,
        maxManagers: json['maxManagers'] as int,
        maxTrainers: json['maxTrainers'] as int,
        maxReceptionists: json['maxReceptionists'] as int,
        maxStaff: json['maxStaff'] as int,
        maxMembers: json['maxMembers'] as int,
        maxStorageMb: json['maxStorageMb'] as int,
      );
}

/// `GET /onboarding/plans` — every plan a tenant can choose/switch to.
/// Reused from the onboarding wizard (frame this list originally backed)
/// for the "Change plan" screen, matching web's own `PlanComparison`.
class SubscriptionPlanOption {
  const SubscriptionPlanOption({
    required this.id,
    required this.slug,
    required this.name,
    required this.description,
    required this.priceMonthly,
    required this.priceYearly,
    required this.currency,
    required this.trialDays,
    required this.sortOrder,
    required this.limits,
    required this.features,
  });

  final String id;
  final String slug;
  final String name;
  final String description;
  final double priceMonthly;
  final double priceYearly;
  final String currency;
  final int trialDays;
  final int sortOrder;
  final PlanLimits limits;
  final List<PlanFeature> features;

  factory SubscriptionPlanOption.fromJson(Map<String, dynamic> json) =>
      SubscriptionPlanOption(
        id: json['id'] as String,
        slug: json['slug'] as String,
        name: json['name'] as String,
        description: json['description'] as String,
        priceMonthly: (json['priceMonthly'] as num).toDouble(),
        priceYearly: (json['priceYearly'] as num).toDouble(),
        currency: json['currency'] as String,
        trialDays: json['trialDays'] as int,
        sortOrder: json['sortOrder'] as int,
        limits: PlanLimits.fromJson(json['limits'] as Map<String, dynamic>),
        features: (json['features'] as List)
            .map((f) => PlanFeature.fromJson(f as Map<String, dynamic>))
            .toList(),
      );
}
