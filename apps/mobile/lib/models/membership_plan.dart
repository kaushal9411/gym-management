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

  static MembershipDurationType fromApi(String v) => switch (v) {
        'DAYS' => MembershipDurationType.days,
        'WEEKS' => MembershipDurationType.weeks,
        'YEARS' => MembershipDurationType.years,
        _ => MembershipDurationType.months,
      };
}

/// Mirrors `MembershipPlanDto` (`GET /membership-plans`,
/// `GET /membership-plans/:id`) — the full 32-field shape, matching web's
/// plan form exactly (design frame "7. Membership plans").
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
    required this.validityStart,
    required this.validityEnd,
    required this.gracePeriodDays,
    required this.renewalWindowDays,
    required this.autoRenewalAllowed,
    required this.minAge,
    required this.maxAge,
    required this.memberCount,
    required this.deletedAt,
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
  final DateTime? validityStart;
  final DateTime? validityEnd;
  final int gracePeriodDays;
  final int renewalWindowDays;
  final bool autoRenewalAllowed;
  final int? minAge;
  final int? maxAge;
  final int memberCount;

  /// Non-null means soft-deleted — same convention as `GymMember`/`StaffMember`.
  final DateTime? deletedAt;

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

  factory MembershipPlan.fromJson(Map<String, dynamic> json) => MembershipPlan(
        id: json['id'] as String,
        name: json['name'] as String,
        planCode: json['planCode'] as String? ?? '',
        description: json['description'] as String?,
        category: json['category'] as String?,
        durationValue: json['durationValue'] as int,
        durationType:
            MembershipDurationTypeX.fromApi(json['durationType'] as String),
        price: double.parse(json['price'] as String),
        joiningFee: double.parse(json['joiningFee'] as String? ?? '0'),
        taxPercentage: double.parse(json['taxPercentage'] as String? ?? '0'),
        discountPercentage:
            double.parse(json['discountPercentage'] as String? ?? '0'),
        isActive: json['isActive'] as bool? ?? true,
        displayOrder: json['displayOrder'] as int? ?? 0,
        notes: json['notes'] as String?,
        gymAccessAllBranches: json['gymAccessAllBranches'] as bool? ?? false,
        ptSessionsIncluded: json['ptSessionsIncluded'] as int? ?? 0,
        groupClassesIncluded: json['groupClassesIncluded'] as int? ?? 0,
        dietConsultationIncluded:
            json['dietConsultationIncluded'] as bool? ?? false,
        lockerAccess: json['lockerAccess'] as bool? ?? false,
        guestPasses: json['guestPasses'] as int? ?? 0,
        freezeAllowed: json['freezeAllowed'] as bool? ?? false,
        freezeDaysLimit: json['freezeDaysLimit'] as int?,
        validityStart: json['validityStart'] == null
            ? null
            : DateTime.parse(json['validityStart'] as String),
        validityEnd: json['validityEnd'] == null
            ? null
            : DateTime.parse(json['validityEnd'] as String),
        gracePeriodDays: json['gracePeriodDays'] as int? ?? 0,
        renewalWindowDays: json['renewalWindowDays'] as int? ?? 0,
        autoRenewalAllowed: json['autoRenewalAllowed'] as bool? ?? false,
        minAge: json['minAge'] as int?,
        maxAge: json['maxAge'] as int?,
        memberCount: json['memberCount'] as int? ?? 0,
        deletedAt: json['deletedAt'] == null
            ? null
            : DateTime.parse(json['deletedAt'] as String),
      );
}
