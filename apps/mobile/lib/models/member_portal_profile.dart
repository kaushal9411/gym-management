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
      );
}
