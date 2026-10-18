/// One row of `notVisited14Days`/`expiringThisWeek`/`highestDues` —
/// `detail` is pre-formatted by the backend (days since last visit, days
/// until expiry, or the amount due as a string), same shape for all three
/// so the UI doesn't need three different renderers.
class MemberStatsPerson {
  const MemberStatsPerson({
    required this.id,
    required this.name,
    required this.memberId,
    required this.detail,
  });

  final String id;
  final String name;
  final String memberId;
  final String detail;

  factory MemberStatsPerson.fromJson(Map<String, dynamic> json) =>
      MemberStatsPerson(
        id: json['id'] as String,
        name: json['name'] as String,
        memberId: json['memberId'] as String,
        detail: json['detail'] as String,
      );
}

class MemberStatusCounts {
  const MemberStatusCounts({
    required this.active,
    required this.inactive,
    required this.frozen,
  });

  final int active;
  final int inactive;
  final int frozen;

  factory MemberStatusCounts.fromJson(Map<String, dynamic> json) =>
      MemberStatusCounts(
        active: json['ACTIVE'] as int? ?? 0,
        inactive: json['INACTIVE'] as int? ?? 0,
        frozen: json['FROZEN'] as int? ?? 0,
      );
}

class MemberStatsBucket {
  const MemberStatsBucket({required this.label, required this.count});

  final String label;
  final int count;

  factory MemberStatsBucket.fromJson(Map<String, dynamic> json) =>
      MemberStatsBucket(
        label: (json['label'] ?? json['name']) as String,
        count: json['count'] as int,
      );
}

class MemberJoinedMonth {
  const MemberJoinedMonth({required this.month, required this.count});

  final String month;
  final int count;

  factory MemberJoinedMonth.fromJson(Map<String, dynamic> json) =>
      MemberJoinedMonth(
        month: json['month'] as String,
        count: json['count'] as int,
      );
}

/// Mirrors `MemberStatsDto` (`GET /members/stats`, `members:view` — same
/// permission as the list itself) — counts and short lists backing the
/// Members list screen's KPI tiles and report panels. Web's exact
/// counterpart: `apps/tenant-web/src/features/members/components/list/
/// members-overview.tsx`.
class MemberStats {
  const MemberStats({
    required this.total,
    required this.byStatus,
    required this.newThisMonth,
    required this.expiringIn30Days,
    required this.withDuesCount,
    required this.withDuesAmount,
    required this.checkedInToday,
    required this.plans,
    required this.gender,
    required this.source,
    required this.joinedByMonth,
    required this.notVisited14Days,
    required this.expiringThisWeek,
    required this.highestDues,
  });

  final int total;
  final MemberStatusCounts byStatus;
  final int newThisMonth;
  final int expiringIn30Days;
  final int withDuesCount;
  final double withDuesAmount;
  final int checkedInToday;
  final List<MemberStatsBucket> plans;
  final List<MemberStatsBucket> gender;
  final List<MemberStatsBucket> source;
  final List<MemberJoinedMonth> joinedByMonth;
  final List<MemberStatsPerson> notVisited14Days;
  final List<MemberStatsPerson> expiringThisWeek;
  final List<MemberStatsPerson> highestDues;

  factory MemberStats.fromJson(Map<String, dynamic> json) {
    List<MemberStatsPerson> people(String key) =>
        ((json[key] as List?) ?? const [])
            .map((e) => MemberStatsPerson.fromJson(e as Map<String, dynamic>))
            .toList();
    List<MemberStatsBucket> buckets(String key) =>
        ((json[key] as List?) ?? const [])
            .map((e) => MemberStatsBucket.fromJson(e as Map<String, dynamic>))
            .toList();

    final withDues = json['withDues'] as Map<String, dynamic>? ?? const {};
    return MemberStats(
      total: json['total'] as int? ?? 0,
      byStatus: json['byStatus'] == null
          ? const MemberStatusCounts(active: 0, inactive: 0, frozen: 0)
          : MemberStatusCounts.fromJson(
              json['byStatus'] as Map<String, dynamic>,),
      newThisMonth: json['newThisMonth'] as int? ?? 0,
      expiringIn30Days: json['expiringIn30Days'] as int? ?? 0,
      withDuesCount: withDues['count'] as int? ?? 0,
      withDuesAmount: double.tryParse(withDues['amount'] as String? ?? '') ?? 0,
      checkedInToday: json['checkedInToday'] as int? ?? 0,
      plans: buckets('plans'),
      gender: buckets('gender'),
      source: buckets('source'),
      joinedByMonth: ((json['joinedByMonth'] as List?) ?? const [])
          .map((e) => MemberJoinedMonth.fromJson(e as Map<String, dynamic>))
          .toList(),
      notVisited14Days: people('notVisited14Days'),
      expiringThisWeek: people('expiringThisWeek'),
      highestDues: people('highestDues'),
    );
  }
}
