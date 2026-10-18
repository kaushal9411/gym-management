import 'staff_member.dart';

/// Roster figures for the Team screen, computed client-side from the full
/// `/staff` list (web asks the same endpoint 13 times with `limit: 1` and
/// reads `.total`; one paged walk is cheaper on mobile and also gives the
/// matching people for the tile / panel detail sheets).
///
/// Counting rules mirror web: *total* includes soft-deleted accounts, the
/// status / role / work-status buckets do not.
class StaffStats {
  const StaffStats({
    required this.everyone,
    required this.live,
    required this.byStatus,
    required this.byRole,
    required this.byWorkStatus,
  });

  /// Everyone, deleted included (web `total` tile).
  final List<StaffMember> everyone;

  /// Everyone not soft-deleted.
  final List<StaffMember> live;
  final Map<String, List<StaffMember>> byStatus;
  final Map<StaffRole, List<StaffMember>> byRole;
  final Map<String, List<StaffMember>> byWorkStatus;

  static const statusOrder = [
    'ACTIVE',
    'PENDING_VERIFICATION',
    'LOCKED',
    'SUSPENDED',
    'DEACTIVATED',
  ];
  static const workStatusOrder = [
    'WORKING',
    'ON_LEAVE',
    'NOTICE_PERIOD',
    'TERMINATED',
  ];

  int get total => everyone.length;
  int count(String status) => byStatus[status]?.length ?? 0;
  int roleCount(StaffRole r) => byRole[r]?.length ?? 0;
  int workCount(String w) => byWorkStatus[w]?.length ?? 0;
  int get deleted => everyone.length - live.length;

  List<StaffMember> get lockedOrSuspended =>
      [...?byStatus['LOCKED'], ...?byStatus['SUSPENDED']];

  /// Invited but never activated, oldest invite first would hide the newest,
  /// so newest first like web's `sortBy: createdAt, desc`.
  List<StaffMember> get pendingNewestFirst {
    final list = [...?byStatus['PENDING_VERIFICATION']];
    list.sort(
      (a, b) => (b.createdAt ?? b.joiningDate)
          .compareTo(a.createdAt ?? a.joiningDate),
    );
    return list;
  }

  factory StaffStats.from(List<StaffMember> all) {
    final live = all.where((s) => !s.isDeleted).toList();
    final byStatus = <String, List<StaffMember>>{};
    final byRole = <StaffRole, List<StaffMember>>{};
    final byWork = <String, List<StaffMember>>{};
    for (final s in live) {
      (byStatus[s.status] ??= []).add(s);
      (byRole[s.role] ??= []).add(s);
      final w = s.workStatus;
      if (w != null) (byWork[w] ??= []).add(s);
    }
    return StaffStats(
      everyone: all,
      live: live,
      byStatus: byStatus,
      byRole: byRole,
      byWorkStatus: byWork,
    );
  }
}
