/// Mirrors the `GET /roles` / `GET /roles/:roleId` shape — system roles
/// (OWNER, MANAGER, ...) plus any tenant-defined custom roles.
class TenantRole {
  const TenantRole({
    required this.id,
    required this.name,
    required this.description,
    required this.isSystem,
    required this.isActive,
    required this.userCount,
    required this.permissions,
    this.priority = 0,
    this.isDefault = false,
  });

  final String id;
  final String name;
  final String? description;
  final bool isSystem;
  final bool isActive;
  final int userCount;
  final List<String> permissions;
  final int priority;
  final bool isDefault;

  factory TenantRole.fromJson(Map<String, dynamic> json) => TenantRole(
        id: json['id']?.toString() ?? '',
        name: json['name']?.toString() ?? '',
        description: json['description'] as String?,
        isSystem: json['isSystem'] as bool? ?? false,
        isActive: json['isActive'] as bool? ?? true,
        userCount: (json['userCount'] as num?)?.toInt() ?? 0,
        permissions: (json['permissions'] as List? ?? const [])
            .map((p) => p.toString())
            .toList(),
        priority: (json['priority'] as num?)?.toInt() ?? 0,
        isDefault: json['isDefault'] as bool? ?? false,
      );

  /// "members:read" → "members" — groups the flat permission list for display.
  Map<String, List<String>> get permissionsByResource {
    final grouped = <String, List<String>>{};
    for (final key in permissions) {
      final resource = key.split(':').first;
      (grouped[resource] ??= []).add(key);
    }
    return grouped;
  }
}

/// `OWNER` -> `Owner`, `SUPER_ADMIN` -> `Super admin`; custom role names that
/// already carry their own casing are left alone (web `displayRoleName`).
String displayRoleName(String name) {
  if (name != name.toUpperCase()) return name;
  final spaced = name.replaceAll('_', ' ').toLowerCase();
  if (spaced.isEmpty) return spaced;
  return spaced[0].toUpperCase() + spaced.substring(1);
}

const _systemRoleBlurbs = {
  'OWNER': 'Full control of the gym, billing and every setting.',
  'MANAGER': 'Runs the branch day to day. Everything except billing.',
  'RECEPTIONIST': 'Front desk: members, check-ins and payments.',
  'TRAINER': 'Workout and diet plans for assigned members.',
  'MEMBER': 'Member portal access only.',
  'SUPER_ADMIN': 'Platform-level access.',
};

/// One-line description for a role card (web `roleBlurb`).
String roleBlurb(TenantRole role) {
  if (role.isSystem && _systemRoleBlurbs.containsKey(role.name)) {
    return _systemRoleBlurbs[role.name]!;
  }
  final d = role.description;
  return (d == null || d.isEmpty) ? 'No description.' : d;
}
