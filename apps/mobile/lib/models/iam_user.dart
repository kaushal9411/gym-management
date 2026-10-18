/// A user's role assignment, as returned inline on `IamUser` — the same
/// `{id, name, isSystem}` shape `TenantRole` uses for its own identity.
class UserRoleSummary {
  const UserRoleSummary({
    required this.id,
    required this.name,
    required this.isSystem,
  });

  final String id;
  final String name;
  final bool isSystem;

  factory UserRoleSummary.fromJson(Map<String, dynamic> json) =>
      UserRoleSummary(
        id: json['id']?.toString() ?? '',
        name: json['name']?.toString() ?? '',
        isSystem: json['isSystem'] as bool? ?? false,
      );
}

/// One branch a user has access to.
class UserBranchAccess {
  const UserBranchAccess({
    required this.branchId,
    required this.branchName,
    required this.isPrimary,
    required this.expiresAt,
  });

  final String branchId;
  final String branchName;
  final bool isPrimary;
  final DateTime? expiresAt;

  factory UserBranchAccess.fromJson(Map<String, dynamic> json) =>
      UserBranchAccess(
        branchId: json['branchId']?.toString() ?? '',
        branchName: json['branchName']?.toString() ?? '',
        isPrimary: json['isPrimary'] as bool? ?? false,
        expiresAt: json['expiresAt'] == null
            ? null
            : DateTime.tryParse(json['expiresAt'].toString()),
      );
}

/// A per-user GRANT/DENY on top of whatever their roles already grant.
class PermissionOverride {
  const PermissionOverride({required this.key, required this.mode});

  final String key;
  final String mode; // 'GRANT' | 'DENY'

  Map<String, dynamic> toJson() => {'key': key, 'mode': mode};

  factory PermissionOverride.fromJson(Map<String, dynamic> json) =>
      PermissionOverride(
        key: json['key']?.toString() ?? '',
        mode: json['mode']?.toString() ?? 'GRANT',
      );
}

/// Mirrors `UserListItemDto`/`UserDetailDto` (`GET /users`, `/users/:id`) as
/// one class, the same list/detail-merge pattern as [GymMember] and
/// [StaffMember] — detail-only fields stay empty on rows from the list
/// endpoint. This is the **identity/access** view of a person (roles,
/// branch access, permission overrides, login history) — a different lens
/// from [StaffMember], which is the same person's employment profile.
class IamUser {
  const IamUser({
    required this.id,
    required this.name,
    required this.email,
    required this.phone,
    required this.status,
    required this.avatarUrl,
    required this.roles,
    required this.allBranches,
    required this.branches,
    required this.lastLoginAt,
    required this.createdAt,
    required this.deletedAt,
    this.mfaEnabled = false,
    this.emergencyContactName,
    this.emergencyContactPhone,
    this.emergencyContactRelation,
    this.permissionOverrides = const [],
    this.effectivePermissions = const [],
    this.emailVerifiedAt,
    this.updatedAt,
  });

  final String id;
  final String name;
  final String email;
  final String? phone;
  final String status;
  final String? avatarUrl;
  final List<UserRoleSummary> roles;
  final bool allBranches;
  final List<UserBranchAccess> branches;
  final DateTime? lastLoginAt;
  final DateTime createdAt;
  final DateTime? deletedAt;
  final bool mfaEnabled;
  final String? emergencyContactName;
  final String? emergencyContactPhone;
  final String? emergencyContactRelation;
  final List<PermissionOverride> permissionOverrides;
  final List<String> effectivePermissions;
  final DateTime? emailVerifiedAt;
  final DateTime? updatedAt;

  bool get isDeleted => deletedAt != null;

  /// Suspended / deactivated / soft-deleted accounts offer "restore" instead
  /// of suspend + deactivate (web `StatusActions`).
  bool get needsRestore =>
      isDeleted || status == 'SUSPENDED' || status == 'DEACTIVATED';

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

  factory IamUser.fromJson(Map<String, dynamic> json) => IamUser(
        id: json['id']?.toString() ?? '',
        name: json['name']?.toString() ?? '',
        email: json['email']?.toString() ?? '',
        phone: json['phone'] as String?,
        status: json['status']?.toString() ?? '',
        avatarUrl: json['avatarUrl'] as String?,
        roles: (json['roles'] as List? ?? const [])
            .whereType<Map<String, dynamic>>()
            .map(UserRoleSummary.fromJson)
            .toList(),
        allBranches: json['allBranches'] as bool? ?? false,
        branches: (json['branches'] as List? ?? const [])
            .whereType<Map<String, dynamic>>()
            .map(UserBranchAccess.fromJson)
            .toList(),
        lastLoginAt: json['lastLoginAt'] == null
            ? null
            : DateTime.tryParse(json['lastLoginAt'].toString()),
        createdAt: DateTime.tryParse(json['createdAt']?.toString() ?? '') ??
            DateTime.now(),
        deletedAt: json['deletedAt'] == null
            ? null
            : DateTime.tryParse(json['deletedAt'].toString()),
        mfaEnabled: json['mfaEnabled'] as bool? ?? false,
        emergencyContactName: json['emergencyContactName'] as String?,
        emergencyContactPhone: json['emergencyContactPhone'] as String?,
        emergencyContactRelation: json['emergencyContactRelation'] as String?,
        permissionOverrides: (json['permissionOverrides'] as List? ?? const [])
            .whereType<Map<String, dynamic>>()
            .map(PermissionOverride.fromJson)
            .toList(),
        effectivePermissions:
            (json['effectivePermissions'] as List? ?? const [])
                .map((p) => p.toString())
                .toList(),
        emailVerifiedAt: json['emailVerifiedAt'] == null
            ? null
            : DateTime.tryParse(json['emailVerifiedAt'].toString()),
        updatedAt: json['updatedAt'] == null
            ? null
            : DateTime.tryParse(json['updatedAt'].toString()),
      );
}
