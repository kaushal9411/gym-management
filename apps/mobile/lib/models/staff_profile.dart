/// Mirrors `ProfileDto` (`GET /profile`, `PATCH /profile`) — the staff
/// plane's own-account profile, distinct from `UserProfile` (`/auth/me`,
/// used app-wide for the header initials) which lacks avatar/branch data.
class EmergencyContact {
  const EmergencyContact({this.name, this.phone, this.relation});

  final String? name;
  final String? phone;
  final String? relation;

  factory EmergencyContact.fromJson(Map<String, dynamic> json) =>
      EmergencyContact(
        name: json['name'] as String?,
        phone: json['phone'] as String?,
        relation: json['relation'] as String?,
      );
}

class BranchAccessEntry {
  const BranchAccessEntry({
    required this.branchId,
    required this.branchName,
    required this.isPrimary,
    this.expiresAt,
  });

  final String branchId;
  final String branchName;
  final bool isPrimary;
  final String? expiresAt;

  factory BranchAccessEntry.fromJson(Map<String, dynamic> json) =>
      BranchAccessEntry(
        branchId: json['branchId'] as String,
        branchName: json['branchName'] as String,
        isPrimary: json['isPrimary'] as bool? ?? false,
        expiresAt: json['expiresAt'] as String?,
      );
}

class BranchAccess {
  const BranchAccess({required this.allBranches, required this.branches});

  final bool allBranches;
  final List<BranchAccessEntry> branches;

  factory BranchAccess.fromJson(Map<String, dynamic> json) => BranchAccess(
        allBranches: json['allBranches'] as bool? ?? false,
        branches: (json['branches'] as List? ?? [])
            .map((e) => BranchAccessEntry.fromJson(e as Map<String, dynamic>))
            .toList(),
      );
}

class StaffProfile {
  const StaffProfile({
    required this.id,
    required this.name,
    required this.email,
    required this.phone,
    required this.avatarUrl,
    required this.roles,
    required this.emergencyContact,
    required this.notificationPreferences,
    required this.mfaEnabled,
    required this.branchAccess,
    required this.lastLoginAt,
  });

  final String id;
  final String name;
  final String email;
  final String? phone;
  final String? avatarUrl;
  final List<String> roles;
  final EmergencyContact emergencyContact;
  final Map<String, bool> notificationPreferences;
  final bool mfaEnabled;
  final BranchAccess branchAccess;
  final String? lastLoginAt;

  factory StaffProfile.fromJson(Map<String, dynamic> json) => StaffProfile(
        id: json['id'] as String,
        name: json['name'] as String,
        email: json['email'] as String,
        phone: json['phone'] as String?,
        avatarUrl: json['avatarUrl'] as String?,
        roles: (json['roles'] as List?)?.cast<String>() ?? const [],
        emergencyContact: EmergencyContact.fromJson(
          json['emergencyContact'] as Map<String, dynamic>? ?? const {},
        ),
        notificationPreferences:
            (json['notificationPreferences'] as Map<String, dynamic>? ?? {})
                .map((k, v) => MapEntry(k, v as bool)),
        mfaEnabled: json['mfaEnabled'] as bool? ?? false,
        branchAccess: BranchAccess.fromJson(
          json['branchAccess'] as Map<String, dynamic>? ?? const {},
        ),
        lastLoginAt: json['lastLoginAt'] as String?,
      );
}
