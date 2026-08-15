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
    required this.autoRenew,
  });

  final String planId;
  final String planName;
  final DateTime startDate;
  final DateTime endDate;
  final String status;
  final bool autoRenew;

  factory CurrentMembershipSummary.fromJson(Map<String, dynamic> json) =>
      CurrentMembershipSummary(
        planId: json['planId'] as String,
        planName: json['planName'] as String,
        startDate: DateTime.parse(json['startDate'] as String),
        endDate: DateTime.parse(json['endDate'] as String),
        status: json['status'] as String,
        autoRenew: json['autoRenew'] as bool? ?? false,
      );
}

/// One row of `membershipHistory[]` (`GET /members/:id`) — every plan the
/// member has ever been assigned, superseded ones included.
class MembershipHistoryEntry {
  const MembershipHistoryEntry({
    required this.id,
    required this.planName,
    required this.startDate,
    required this.endDate,
    required this.priceAtAssignment,
    required this.status,
    required this.autoRenew,
  });

  final String id;
  final String planName;
  final DateTime startDate;
  final DateTime endDate;
  final double priceAtAssignment;
  final String status;
  final bool autoRenew;

  factory MembershipHistoryEntry.fromJson(Map<String, dynamic> json) =>
      MembershipHistoryEntry(
        id: json['id'] as String,
        planName: json['planName'] as String,
        startDate: DateTime.parse(json['startDate'] as String),
        endDate: DateTime.parse(json['endDate'] as String),
        priceAtAssignment: double.parse(json['priceAtAssignment'] as String),
        status: json['status'] as String,
        autoRenew: json['autoRenew'] as bool? ?? false,
      );
}

/// One row of `freezeHistory[]` (`GET /members/:id`).
class FreezeHistoryEntry {
  const FreezeHistoryEntry({
    required this.id,
    required this.reason,
    required this.frozenAt,
    required this.unfrozenAt,
  });

  final String id;
  final String? reason;
  final DateTime frozenAt;
  final DateTime? unfrozenAt;

  factory FreezeHistoryEntry.fromJson(Map<String, dynamic> json) =>
      FreezeHistoryEntry(
        id: json['id'] as String,
        reason: json['reason'] as String?,
        frozenAt: DateTime.parse(json['frozenAt'] as String),
        unfrozenAt: json['unfrozenAt'] == null
            ? null
            : DateTime.parse(json['unfrozenAt'] as String),
      );
}

/// Mirrors `MemberListItemDto`/`MemberDetailDto` (`GET /members`,
/// `/members/:id`) as one class, same pattern as [StaffMember] — list
/// responses just leave detail-only fields null. The personal/address/
/// health fields (frames "7d"–"7f") are `MemberDetailDto`-only too, so a
/// `GymMember` read off the list screen will have them null even though
/// the member record itself may have real values.
class GymMember {
  const GymMember({
    required this.id,
    required this.memberId,
    required this.firstName,
    required this.lastName,
    required this.name,
    required this.profilePhotoUrl,
    required this.email,
    required this.phone,
    required this.status,
    required this.branch,
    required this.trainer,
    required this.currentMembership,
    required this.joiningDate,
    required this.deletedAt,
    this.qrCodeToken,
    this.qrCodeImageUrl,
    this.canCheckIn,
    this.membershipHistory = const [],
    this.freezeHistory = const [],
    this.gender,
    this.dateOfBirth,
    this.bloodGroup,
    this.height,
    this.weight,
    this.occupation,
    this.addressLine,
    this.city,
    this.state,
    this.country,
    this.postalCode,
    this.emergencyContactName,
    this.emergencyContactPhone,
    this.emergencyContactRelation,
    this.medicalConditions,
    this.allergies,
    this.fitnessGoals,
    this.notes,
  });

  final String id;
  final String memberId;
  final String firstName;
  final String lastName;
  final String name;
  final String? profilePhotoUrl;
  final String? email;
  final String? phone;
  final String status;
  final MemberBranchSummary branch;
  final MemberTrainerSummary? trainer;
  final CurrentMembershipSummary? currentMembership;
  final DateTime joiningDate;

  /// Non-null means soft-deleted — the header's Delete/Restore action pair
  /// keys off this, same convention as `StaffMember`.
  final DateTime? deletedAt;

  /// Detail-only (`GET /members/:id`) — null on a `GymMember` read off the
  /// list screen.
  final String? qrCodeToken;
  final String? qrCodeImageUrl;
  final bool? canCheckIn;
  final List<MembershipHistoryEntry> membershipHistory;
  final List<FreezeHistoryEntry> freezeHistory;

  final String? gender;
  final String? dateOfBirth;
  final String? bloodGroup;
  final double? height;
  final double? weight;
  final String? occupation;
  final String? addressLine;
  final String? city;
  final String? state;
  final String? country;
  final String? postalCode;
  final String? emergencyContactName;
  final String? emergencyContactPhone;
  final String? emergencyContactRelation;
  final String? medicalConditions;
  final String? allergies;
  final String? fitnessGoals;
  final String? notes;

  factory GymMember.fromJson(Map<String, dynamic> json) => GymMember(
        id: json['id'] as String,
        memberId: json['memberId'] as String,
        firstName: json['firstName'] as String,
        lastName: json['lastName'] as String,
        name: json['name'] as String,
        profilePhotoUrl: json['profilePhotoUrl'] as String?,
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
        deletedAt: json['deletedAt'] == null
            ? null
            : DateTime.parse(json['deletedAt'] as String),
        qrCodeToken: json['qrCodeToken'] as String?,
        qrCodeImageUrl: json['qrCodeImageUrl'] as String?,
        canCheckIn: json['canCheckIn'] as bool?,
        membershipHistory: json['membershipHistory'] == null
            ? const []
            : (json['membershipHistory'] as List)
                .map(
                  (e) => MembershipHistoryEntry.fromJson(
                    e as Map<String, dynamic>,
                  ),
                )
                .toList(),
        freezeHistory: json['freezeHistory'] == null
            ? const []
            : (json['freezeHistory'] as List)
                .map(
                  (e) => FreezeHistoryEntry.fromJson(e as Map<String, dynamic>),
                )
                .toList(),
        gender: json['gender'] as String?,
        dateOfBirth: json['dateOfBirth'] as String?,
        bloodGroup: json['bloodGroup'] as String?,
        height: (json['height'] as num?)?.toDouble(),
        weight: (json['weight'] as num?)?.toDouble(),
        occupation: json['occupation'] as String?,
        addressLine: json['addressLine'] as String?,
        city: json['city'] as String?,
        state: json['state'] as String?,
        country: json['country'] as String?,
        postalCode: json['postalCode'] as String?,
        emergencyContactName: json['emergencyContactName'] as String?,
        emergencyContactPhone: json['emergencyContactPhone'] as String?,
        emergencyContactRelation: json['emergencyContactRelation'] as String?,
        medicalConditions: json['medicalConditions'] as String?,
        allergies: json['allergies'] as String?,
        fitnessGoals: json['fitnessGoals'] as String?,
        notes: json['notes'] as String?,
      );
}
