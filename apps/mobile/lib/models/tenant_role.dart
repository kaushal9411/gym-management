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
  });

  final String id;
  final String name;
  final String? description;
  final bool isSystem;
  final bool isActive;
  final int userCount;
  final List<String> permissions;

  factory TenantRole.fromJson(Map<String, dynamic> json) => TenantRole(
        id: json['id'] as String,
        name: json['name'] as String,
        description: json['description'] as String?,
        isSystem: json['isSystem'] as bool,
        isActive: json['isActive'] as bool? ?? true,
        userCount: json['userCount'] as int? ?? 0,
        permissions: (json['permissions'] as List).cast<String>(),
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
