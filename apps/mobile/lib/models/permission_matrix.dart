/// One row of `GET /permissions/matrix`'s `permissions` array.
class MatrixPermission {
  const MatrixPermission({
    required this.key,
    required this.description,
    required this.resource,
  });

  final String key;
  final String? description;
  final String resource;

  factory MatrixPermission.fromJson(Map<String, dynamic> json) {
    final key = json['key']?.toString() ?? '';
    return MatrixPermission(
      key: key,
      description: json['description'] as String?,
      resource: json['resource']?.toString() ?? key.split(':').first,
    );
  }
}

/// One column of the matrix — a role and the permission keys it holds.
class MatrixRole {
  const MatrixRole({
    required this.id,
    required this.name,
    required this.isSystem,
    required this.permissionKeys,
  });

  final String id;
  final String name;
  final bool isSystem;
  final Set<String> permissionKeys;

  factory MatrixRole.fromJson(Map<String, dynamic> json) => MatrixRole(
        id: json['id']?.toString() ?? '',
        name: json['name']?.toString() ?? '',
        isSystem: json['isSystem'] as bool? ?? false,
        permissionKeys: (json['permissionKeys'] as List? ?? const [])
            .map((k) => k.toString())
            .toSet(),
      );
}

/// Mirrors `GET /permissions/matrix` — every permission against every role.
class PermissionMatrix {
  const PermissionMatrix({required this.permissions, required this.roles});

  final List<MatrixPermission> permissions;
  final List<MatrixRole> roles;

  /// Permissions grouped by resource, in first-seen order.
  Map<String, List<MatrixPermission>> get byResource {
    final out = <String, List<MatrixPermission>>{};
    for (final p in permissions) {
      (out[p.resource] ??= []).add(p);
    }
    return out;
  }

  factory PermissionMatrix.fromJson(Map<String, dynamic> json) =>
      PermissionMatrix(
        permissions: (json['permissions'] as List? ?? const [])
            .whereType<Map<String, dynamic>>()
            .map(MatrixPermission.fromJson)
            .toList(),
        roles: (json['roles'] as List? ?? const [])
            .whereType<Map<String, dynamic>>()
            .map(MatrixRole.fromJson)
            .toList(),
      );
}
