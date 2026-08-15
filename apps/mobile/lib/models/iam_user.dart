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
        id: json['id'] as String,
        name: json['name'] as String,
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
        branchId: json['branchId'] as String,
        branchName: json['branchName'] as String,
        isPrimary: json['isPrimary'] as bool? ?? false,
        expiresAt: json['expiresAt'] == null
            ? null
            : DateTime.parse(json['expiresAt'] as String),
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
        key: json['key'] as String,
        mode: json['mode'] as String,
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
    this.emergencyContactName,
    this.emergencyContactPhone,
    this.emergencyContactRelation,
    this.permissionOverrides = const [],
    this.effectivePermissions = const [],
    this.emailVerifiedAt,
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
  final String? emergencyContactName;
  final String? emergencyContactPhone;
  final String? emergencyContactRelation;
  final List<PermissionOverride> permissionOverrides;
  final List<String> effectivePermissions;
  final DateTime? emailVerifiedAt;

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
        id: json['id'] as String,
        name: json['name'] as String,
        email: json['email'] as String,
        phone: json['phone'] as String?,
        status: json['status'] as String,
        avatarUrl: json['avatarUrl'] as String?,
        roles: (json['roles'] as List)
            .map((r) => UserRoleSummary.fromJson(r as Map<String, dynamic>))
            .toList(),
        allBranches: json['allBranches'] as bool? ?? false,
        branches: (json['branches'] as List)
            .map((b) => UserBranchAccess.fromJson(b as Map<String, dynamic>))
            .toList(),
        lastLoginAt: json['lastLoginAt'] == null
            ? null
            : DateTime.parse(json['lastLoginAt'] as String),
        createdAt: DateTime.parse(json['createdAt'] as String),
        deletedAt: json['deletedAt'] == null
            ? null
            : DateTime.parse(json['deletedAt'] as String),
        emergencyContactName: json['emergencyContactName'] as String?,
        emergencyContactPhone: json['emergencyContactPhone'] as String?,
        emergencyContactRelation: json['emergencyContactRelation'] as String?,
        permissionOverrides: json['permissionOverrides'] == null
            ? const []
            : (json['permissionOverrides'] as List)
                .map(
                  (o) => PermissionOverride.fromJson(o as Map<String, dynamic>),
                )
                .toList(),
        effectivePermissions: json['effectivePermissions'] == null
            ? const []
            : (json['effectivePermissions'] as List)
                .map((p) => p as String)
                .toList(),
        emailVerifiedAt: json['emailVerifiedAt'] == null
            ? null
            : DateTime.parse(json['emailVerifiedAt'] as String),
      );
}
