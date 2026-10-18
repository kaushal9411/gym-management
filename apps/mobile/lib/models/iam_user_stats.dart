/// A person flagged in the "Needs attention" lists of `GET /users/stats`
/// (`{id, name, detail}` only — no phone / photo, so none is faked).
class UserStatsPerson {
  const UserStatsPerson({
    required this.id,
    required this.name,
    required this.detail,
  });

  final String id;
  final String name;
  final String detail;

  factory UserStatsPerson.fromJson(Map<String, dynamic> json) =>
      UserStatsPerson(
        id: json['id']?.toString() ?? '',
        name: json['name']?.toString() ?? '',
        detail: json['detail']?.toString() ?? '',
      );
}

class UserRoleCount {
  const UserRoleCount({required this.name, required this.count});

  final String name;
  final int count;
}

/// Mirrors `UserStatsDto` (`GET /users/stats`) — the figures behind the
/// Users tab's KPI tiles and insight panels (web `UsersKpis`/`UsersInsights`).
class IamUserStats {
  const IamUserStats({
    required this.total,
    required this.byStatus,
    required this.mfaEnabled,
    required this.signedInThisWeek,
    required this.pendingInvitations,
    required this.byRole,
    required this.lastSignIn,
    required this.locked,
    required this.pendingVerification,
    required this.dormant,
  });

  final int total;
  final Map<String, int> byStatus;
  final int mfaEnabled;
  final int signedInThisWeek;
  final int pendingInvitations;
  final List<UserRoleCount> byRole;

  /// Keys: today, thisWeek, thisMonth, older, never.
  final Map<String, int> lastSignIn;
  final List<UserStatsPerson> locked;
  final List<UserStatsPerson> pendingVerification;
  final List<UserStatsPerson> dormant;

  int status(String s) => byStatus[s] ?? 0;
  int signIn(String k) => lastSignIn[k] ?? 0;

  bool get nothingToFlag =>
      locked.isEmpty && pendingVerification.isEmpty && dormant.isEmpty;

  factory IamUserStats.fromJson(Map<String, dynamic> json) {
    int n(Object? v) => (v is num) ? v.toInt() : int.tryParse('$v') ?? 0;
    Map<String, int> intMap(Object? raw) => raw is Map
        ? {for (final e in raw.entries) e.key.toString(): n(e.value)}
        : <String, int>{};
    List<UserStatsPerson> people(Object? raw) => (raw as List? ?? const [])
        .whereType<Map<String, dynamic>>()
        .map(UserStatsPerson.fromJson)
        .toList();
    return IamUserStats(
      total: n(json['total']),
      byStatus: intMap(json['byStatus']),
      mfaEnabled: n(json['mfaEnabled']),
      signedInThisWeek: n(json['signedInThisWeek']),
      pendingInvitations: n(json['pendingInvitations']),
      byRole: (json['byRole'] as List? ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(
            (r) => UserRoleCount(
              name: r['name']?.toString() ?? '',
              count: n(r['count']),
            ),
          )
          .toList(),
      lastSignIn: intMap(json['lastSignIn']),
      locked: people(json['locked']),
      pendingVerification: people(json['pendingVerification']),
      dormant: people(json['dormant']),
    );
  }
}
