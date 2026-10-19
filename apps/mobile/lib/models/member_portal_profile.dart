import 'gym_member.dart';

/// Mirrors what `GET /portal/me` returns — the same `MemberDetailDto` the
/// staff-side member detail page renders (it's the member's own data, so
/// nothing is hidden). Only the fields the member screens actually use are
/// modeled; [CurrentMembershipSummary] and [MemberBranchSummary] are reused
/// from [GymMember] rather than redeclared.
class MemberPortalProfile {
  const MemberPortalProfile({
    required this.id,
    required this.memberId,
    required this.name,
    required this.email,
    required this.phone,
    required this.status,
    required this.branch,
    required this.currentMembership,
    required this.joiningDate,
    this.qrCodeImageUrl,
    this.targetWeightKg,
  });

  final String id;
  final String memberId;
  final String name;
  final String? email;
  final String? phone;
  final String status;
  final MemberBranchSummary branch;
  final CurrentMembershipSummary? currentMembership;
  final DateTime joiningDate;

  /// Check-in QR (a `data:` URL or object-storage URL); null when none yet.
  final String? qrCodeImageUrl;

  /// The member's target weight (kg) set by staff when a membership was
  /// assigned — the newest `membershipHistory[]` row that has one; null when
  /// none was ever set. Backs the goal-progress card on Body Measurements.
  final double? targetWeightKg;

  String get initials {
    final words =
        name.trim().split(RegExp(r'\s+')).where((w) => w.isNotEmpty).toList();
    if (words.isEmpty) return '?';
    if (words.length == 1) {
      return words.first
          .substring(0, words.first.length.clamp(0, 2))
          .toUpperCase();
    }
    return (words[0][0] + words[1][0]).toUpperCase();
  }

  /// Days until the current membership lapses — negative once expired.
  int? get daysLeft {
    final end = currentMembership?.endDate;
    if (end == null) return null;
    final today = DateTime.now();
    return DateTime(end.year, end.month, end.day)
        .difference(DateTime(today.year, today.month, today.day))
        .inDays;
  }

  factory MemberPortalProfile.fromJson(Map<String, dynamic> json) =>
      MemberPortalProfile(
        id: json['id'] as String,
        memberId: json['memberId'] as String? ?? '',
        name: json['name'] as String? ?? '',
        email: json['email'] as String?,
        phone: json['phone'] as String?,
        status: json['status'] as String? ?? '',
        branch: MemberBranchSummary.fromJson(
          json['branch'] as Map<String, dynamic>,
        ),
        currentMembership: json['currentMembership'] == null
            ? null
            : CurrentMembershipSummary.fromJson(
                json['currentMembership'] as Map<String, dynamic>,
              ),
        joiningDate: DateTime.parse(json['joiningDate'] as String),
        qrCodeImageUrl: json['qrCodeImageUrl'] as String?,
        targetWeightKg: _targetWeight(json['membershipHistory']),
      );

  /// `membershipHistory` is newest first; DECIMAL arrives as a string.
  static double? _targetWeight(Object? history) {
    if (history is! List) return null;
    for (final h in history) {
      if (h is! Map) continue;
      final v = double.tryParse(h['targetWeight']?.toString() ?? '');
      if (v != null && v > 0) return v;
    }
    return null;
  }
}
