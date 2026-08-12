class MemberBranchSummary {
  const MemberBranchSummary({required this.id, required this.name});

  final String id;
  final String name;

  factory MemberBranchSummary.fromJson(Map<String, dynamic> json) =>
      MemberBranchSummary(
        id: json['id'] as String,
        name: json['name'] as String,
      );
}

class MemberTrainerSummary {
  const MemberTrainerSummary({required this.id, required this.name});

  final String id;
  final String name;

  factory MemberTrainerSummary.fromJson(Map<String, dynamic> json) =>
      MemberTrainerSummary(
        id: json['id'] as String,
        name: json['name'] as String,
      );
}

class CurrentMembershipSummary {
  const CurrentMembershipSummary({
    required this.planId,
    required this.planName,
    required this.startDate,
    required this.endDate,
    required this.status,
  });

  final String planId;
  final String planName;
  final DateTime startDate;
  final DateTime endDate;
  final String status;

  factory CurrentMembershipSummary.fromJson(Map<String, dynamic> json) =>
      CurrentMembershipSummary(
        planId: json['planId'] as String,
        planName: json['planName'] as String,
        startDate: DateTime.parse(json['startDate'] as String),
        endDate: DateTime.parse(json['endDate'] as String),
        status: json['status'] as String,
      );
}

/// Mirrors `MemberListItemDto`/`MemberDetailDto` (`GET /members`,
/// `/members/:id`) as one class, same pattern as [StaffMember] — list
/// responses just leave detail-only fields null.
class GymMember {
  const GymMember({
    required this.id,
    required this.memberId,
    required this.name,
    required this.email,
    required this.phone,
    required this.status,
    required this.branch,
    required this.trainer,
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
  final MemberTrainerSummary? trainer;
  final CurrentMembershipSummary? currentMembership;
  final DateTime joiningDate;

  factory GymMember.fromJson(Map<String, dynamic> json) => GymMember(
        id: json['id'] as String,
        memberId: json['memberId'] as String,
        name: json['name'] as String,
        email: json['email'] as String?,
        phone: json['phone'] as String?,
        status: json['status'] as String,
        branch: MemberBranchSummary.fromJson(
          json['branch'] as Map<String, dynamic>,
        ),
        trainer: json['trainer'] == null
            ? null
            : MemberTrainerSummary.fromJson(
                json['trainer'] as Map<String, dynamic>,
              ),
        currentMembership: json['currentMembership'] == null
            ? null
            : CurrentMembershipSummary.fromJson(
                json['currentMembership'] as Map<String, dynamic>,
              ),
        joiningDate: DateTime.parse(json['joiningDate'] as String),
      );
}
