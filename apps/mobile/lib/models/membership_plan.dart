enum MembershipDurationType { days, weeks, months, years }

extension MembershipDurationTypeX on MembershipDurationType {
  String get apiValue => switch (this) {
        MembershipDurationType.days => 'DAYS',
        MembershipDurationType.weeks => 'WEEKS',
        MembershipDurationType.months => 'MONTHS',
        MembershipDurationType.years => 'YEARS',
      };

  String get label => switch (this) {
        MembershipDurationType.days => 'Days',
        MembershipDurationType.weeks => 'Weeks',
        MembershipDurationType.months => 'Months',
        MembershipDurationType.years => 'Years',
      };

  /// The same fixed-length approximation the API stores in `durationDays`
  /// (`approximateDurationDays`): only for display / per-month maths, never
  /// for real date arithmetic.
  int approxDays(int value) => switch (this) {
        MembershipDurationType.days => value,
        MembershipDurationType.weeks => value * 7,
        MembershipDurationType.months => value * 30,
        MembershipDurationType.years => value * 365,
      };

  static MembershipDurationType fromApi(String? v) => switch (v) {
        'DAYS' => MembershipDurationType.days,
        'WEEKS' => MembershipDurationType.weeks,
        'YEARS' => MembershipDurationType.years,
        _ => MembershipDurationType.months,
      };
}

int? _asInt(Object? v) {
  if (v == null) return null;
  if (v is num) return v.toInt();
  return int.tryParse(v.toString());
}

/// Prisma DECIMALs (`price`, `joiningFee`, `taxPercentage`,
/// `discountPercentage`) arrive as strings — never cast to `num`.
double _asDouble(Object? v, [double fallback = 0]) {
  if (v == null) return fallback;
  if (v is num) return v.toDouble();
  return double.tryParse(v.toString()) ?? fallback;
}

String? _asText(Object? v) {
  if (v == null) return null;
  final s = v.toString();
  return s.isEmpty ? null : s;
}

DateTime? _asDate(Object? v) =>
    v == null ? null : DateTime.tryParse(v.toString());

/// Discount-then-tax price maths, mirroring web's `computePlanPrice()`
/// (`features/members/utils/plan-pricing.ts`) — keep both in sync. Also
/// backs the add / edit form's live price summary, so what is previewed is
/// exactly what [MembershipPlan] will show once saved.
class PlanPriceBreakdown {
  const PlanPriceBreakdown({
    required this.basePrice,
    required this.discountPercentage,
    required this.taxPercentage,
    required this.joiningFee,
  });

  final double basePrice;
  final double discountPercentage;
  final double taxPercentage;
  final double joiningFee;

  double get discountAmount => basePrice * discountPercentage / 100;

  /// Price after the discount, before tax.
  double get taxable => basePrice - discountAmount;

  double get taxAmount => taxable * taxPercentage / 100;

  /// `(basePrice − discountAmount) + taxAmount` — discount applied before tax.
  double get finalPrice => taxable + taxAmount;

  /// `finalPrice + joiningFee` — the full amount this plan bills to on its own.
  double get totalWithJoiningFee => finalPrice + joiningFee;

  /// Whether the final price differs from the base (web's `hasAdjustment`).
  bool get hasAdjustment => (finalPrice - basePrice).abs() >= 0.005;
}

/// Mirrors `MembershipPlanDto` (`GET /membership-plans`,
/// `GET /membership-plans/:id`), matching web's plan form exactly
/// (design frame "7. Membership plans").
class MembershipPlan {
  const MembershipPlan({
    required this.id,
    required this.name,
    required this.planCode,
    required this.description,
    required this.category,
    required this.durationValue,
    required this.durationType,
    required this.price,
    required this.joiningFee,
    required this.taxPercentage,
    required this.discountPercentage,
    required this.isActive,
    required this.displayOrder,
    required this.notes,
    required this.gymAccessAllBranches,
    required this.ptSessionsIncluded,
    required this.groupClassesIncluded,
    required this.dietConsultationIncluded,
    required this.lockerAccess,
    required this.guestPasses,
    required this.freezeAllowed,
    required this.freezeDaysLimit,
    required this.memberCount,
    required this.deletedAt,
    this.accessBranchIds = const [],
    this.createdAt,
    this.updatedAt,
  });

  final String id;
  final String name;
  final String planCode;
  final String? description;
  final String? category;
  final int durationValue;
  final MembershipDurationType durationType;
  final double price;
  final double joiningFee;
  final double taxPercentage;
  final double discountPercentage;
  final bool isActive;
  final int displayOrder;
  final String? notes;
  final bool gymAccessAllBranches;
  final int ptSessionsIncluded;
  final int groupClassesIncluded;
  final bool dietConsultationIncluded;
  final bool lockerAccess;
  final int guestPasses;
  final bool freezeAllowed;
  final int? freezeDaysLimit;

  /// Members with an ACTIVE membership on this plan (the API counts only
  /// `status = ACTIVE` memberships).
  final int memberCount;

  /// Non-null means soft-deleted — same convention as `GymMember`/`StaffMember`.
  final DateTime? deletedAt;

  /// Branches the plan is limited to when [gymAccessAllBranches] is false.
  final List<String> accessBranchIds;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  bool get isDeleted => deletedAt != null;

  String get durationLabel {
    final unit = durationType.apiValue.toLowerCase();
    final unitLabel =
        durationValue == 1 ? unit.substring(0, unit.length - 1) : unit;
    return '$durationValue $unitLabel';
  }

  String get perksSummary {
    final perks = <String>[
      if (ptSessionsIncluded > 0) 'PT',
      if (dietConsultationIncluded) 'diet',
      if (groupClassesIncluded > 0) 'group classes',
      if (lockerAccess) 'locker',
    ];
    return perks.isEmpty ? 'Gym access only' : '${perks.join(' + ')} included';
  }

  /// The whole price maths in one object (see [PlanPriceBreakdown]).
  PlanPriceBreakdown get breakdown => PlanPriceBreakdown(
        basePrice: price,
        discountPercentage: discountPercentage,
        taxPercentage: taxPercentage,
        joiningFee: joiningFee,
      );

  /// Discount-then-tax, mirroring web's `computePlanPrice()`
  /// (`features/members/utils/plan-pricing.ts`) — keep both in sync.
  double get discountAmount => price * discountPercentage / 100;

  double get taxAmount => (price - discountAmount) * taxPercentage / 100;

  /// `(price − discountAmount) + taxAmount` — discount applied before tax.
  double get finalPrice => price - discountAmount + taxAmount;

  /// `finalPrice + joiningFee` — the full amount this plan bills to on its own.
  double get totalWithJoiningFee => finalPrice + joiningFee;

  /// Approximate length in days (same approximation the API stores).
  int get approxDays => durationType.approxDays(durationValue);

  factory MembershipPlan.fromJson(Map<String, dynamic> json) => MembershipPlan(
        id: json['id'].toString(),
        name: json['name']?.toString() ?? '',
        planCode: json['planCode']?.toString() ?? '',
        description: _asText(json['description']),
        category: _asText(json['category']),
        durationValue: _asInt(json['durationValue']) ?? 1,
        durationType:
            MembershipDurationTypeX.fromApi(json['durationType']?.toString()),
        price: _asDouble(json['price']),
        joiningFee: _asDouble(json['joiningFee']),
        taxPercentage: _asDouble(json['taxPercentage']),
        discountPercentage: _asDouble(json['discountPercentage']),
        isActive: json['isActive'] as bool? ?? true,
        displayOrder: _asInt(json['displayOrder']) ?? 0,
        notes: _asText(json['notes']),
        gymAccessAllBranches: json['gymAccessAllBranches'] as bool? ?? false,
        ptSessionsIncluded: _asInt(json['ptSessionsIncluded']) ?? 0,
        groupClassesIncluded: _asInt(json['groupClassesIncluded']) ?? 0,
        dietConsultationIncluded:
            json['dietConsultationIncluded'] as bool? ?? false,
        lockerAccess: json['lockerAccess'] as bool? ?? false,
        guestPasses: _asInt(json['guestPasses']) ?? 0,
        freezeAllowed: json['freezeAllowed'] as bool? ?? false,
        freezeDaysLimit: _asInt(json['freezeDaysLimit']),
        memberCount: _asInt(json['memberCount']) ?? 0,
        deletedAt: _asDate(json['deletedAt']),
        accessBranchIds: [
          if (json['accessBranchIds'] is List)
            for (final id in json['accessBranchIds'] as List) id.toString(),
        ],
        createdAt: _asDate(json['createdAt']),
        updatedAt: _asDate(json['updatedAt']),
      );
}
