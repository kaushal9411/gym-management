import 'payments_analytics.dart' show jsonList;

/// Mirrors `MemberPlanDto` (`GET /portal/plan`, member token) — the member's
/// CURRENT plan and everything it includes. The server builds the benefit list
/// (one pure util shared with the web portal), so nothing here derives
/// entitlements: a quota of 0 arrives as `included: false`, an uncapped freeze
/// as `quota: null` + note "No limit". Parsing is defensive: a missing field
/// degrades to null / empty, never a made-up number.
String? _str(Object? v) => v is String && v.trim().isNotEmpty ? v : null;

int? _int(Object? v) => v is num ? v.toInt() : null;

/// Stable keys the server sends, in display order.
enum PlanBenefitKey {
  gymAccess('gym_access'),
  ptSessions('pt_sessions'),
  groupClasses('group_classes'),
  dietConsultation('diet_consultation'),
  locker('locker'),
  guestPasses('guest_passes'),
  freeze('freeze'),
  other('');

  const PlanBenefitKey(this.wire);

  final String wire;

  static PlanBenefitKey parse(Object? v) => PlanBenefitKey.values.firstWhere(
        (k) => k.wire == v && k != PlanBenefitKey.other,
        orElse: () => PlanBenefitKey.other,
      );
}

class PlanBenefit {
  const PlanBenefit({
    required this.key,
    required this.label,
    required this.included,
    this.quota,
    this.used,
    this.remaining,
    this.unit,
    this.note,
    this.items = const [],
  });

  final PlanBenefitKey key;
  final String label;
  final bool included;

  /// Plan allowance; null when the benefit has no numeric allowance.
  final int? quota;
  final int? used;
  final int? remaining;

  /// 'sessions' | 'classes' | 'passes' | 'days' for quota benefits.
  final String? unit;

  /// 'All branches', 'No limit', 'Not allowed', 'All used', '2 branches' ...
  final String? note;

  /// Gym access only: branch names when the plan is limited to some branches.
  final List<String> items;

  /// True when this benefit carries a numeric allowance with usage.
  bool get hasQuota => included && quota != null && used != null;

  /// Share of the allowance already used (0..1); 0 when there is no quota.
  double get usedFraction {
    final q = quota;
    final u = used;
    if (!hasQuota || q == null || u == null || q <= 0) return 0;
    return (u / q).clamp(0, 1).toDouble();
  }

  bool get exhausted => hasQuota && (remaining ?? 0) <= 0;

  factory PlanBenefit.fromJson(Map<String, dynamic> j) => PlanBenefit(
        key: PlanBenefitKey.parse(j['key']),
        label: _str(j['label']) ?? 'Benefit',
        included: j['included'] == true,
        quota: _int(j['quota']),
        used: _int(j['used']),
        remaining: _int(j['remaining']),
        unit: _str(j['unit']),
        note: _str(j['note']),
        items: j['items'] is List
            ? (j['items'] as List).whereType<String>().toList()
            : const [],
      );
}

class MemberPlan {
  const MemberPlan({
    required this.name,
    required this.code,
    required this.durationLabel,
    required this.status,
    required this.startDate,
    required this.endDate,
    required this.daysLeft,
    required this.expired,
    required this.totalDays,
    required this.benefits,
    this.category,
    this.description,
  });

  final String name;
  final String code;
  final String? category;
  final String? description;
  final String durationLabel;

  /// Membership status: ACTIVE / PENDING / EXPIRED.
  final String status;

  /// `YYYY-MM-DD` calendar days.
  final String startDate;
  final String endDate;
  final int daysLeft;
  final bool expired;
  final int totalDays;
  final List<PlanBenefit> benefits;

  int get includedCount => benefits.where((b) => b.included).length;

  /// Fraction of the term still remaining (0..1); 0 once expired.
  double get remainingFraction =>
      expired || totalDays <= 0 ? 0 : (daysLeft / totalDays).clamp(0, 1);

  factory MemberPlan.fromJson(Map<String, dynamic> j) => MemberPlan(
        name: _str(j['name']) ?? 'Membership',
        code: _str(j['code']) ?? '',
        category: _str(j['category']),
        description: _str(j['description']),
        durationLabel: _str(j['durationLabel']) ?? '',
        status: _str(j['status']) ?? '',
        startDate: _str(j['startDate']) ?? '',
        endDate: _str(j['endDate']) ?? '',
        daysLeft: _int(j['daysLeft']) ?? 0,
        expired: j['expired'] == true,
        totalDays: _int(j['totalDays']) ?? 0,
        benefits: jsonList(j['benefits']).map(PlanBenefit.fromJson).toList(),
      );
}
