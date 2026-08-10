enum PlanDuration { monthly, quarterly, semiAnnual, annual }

extension PlanDurationX on PlanDuration {
  int get value => switch (this) {
        PlanDuration.monthly => 1,
        PlanDuration.quarterly => 3,
        PlanDuration.semiAnnual => 6,
        PlanDuration.annual => 12,
      };

  /// Every option here maps to `MONTHS` — simpler than exposing the
  /// backend's full DAYS/WEEKS/MONTHS/YEARS matrix on a mobile chip picker.
  String get apiType => 'MONTHS';

  String get label => switch (this) {
        PlanDuration.monthly => 'Monthly',
        PlanDuration.quarterly => 'Quarterly',
        PlanDuration.semiAnnual => '6 months',
        PlanDuration.annual => 'Annual',
      };
}

/// Mirrors `MembershipPlanDto` — only the fields the design's list/create
/// screens use. Perk toggles (PT sessions/group classes) are booleans here
/// even though the backend stores them as counts (`ptSessionsIncluded:
/// number`) — "on" writes 1, "off" writes 0 (see `MembershipPlanFormInput`).
class MembershipPlan {
  const MembershipPlan({
    required this.id,
    required this.name,
    required this.planCode,
    required this.durationValue,
    required this.durationType,
    required this.price,
    required this.isActive,
    required this.ptSessionsIncluded,
    required this.groupClassesIncluded,
    required this.dietConsultationIncluded,
    required this.lockerAccess,
    required this.memberCount,
  });

  final String id;
  final String name;
  final String planCode;
  final int durationValue;
  final String durationType;
  final double price;
  final bool isActive;
  final int ptSessionsIncluded;
  final int groupClassesIncluded;
  final bool dietConsultationIncluded;
  final bool lockerAccess;
  final int memberCount;

  String get durationLabel {
    final unit = durationType.toLowerCase();
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
        durationValue: json['durationValue'] as int,
        durationType: json['durationType'] as String,
        price: double.parse(json['price'] as String),
        isActive: json['isActive'] as bool? ?? true,
        ptSessionsIncluded: json['ptSessionsIncluded'] as int? ?? 0,
        groupClassesIncluded: json['groupClassesIncluded'] as int? ?? 0,
        dietConsultationIncluded:
            json['dietConsultationIncluded'] as bool? ?? false,
        lockerAccess: json['lockerAccess'] as bool? ?? false,
        memberCount: json['memberCount'] as int? ?? 0,
      );
}
