/// One permission in the registry — `key` is the `resource:action` string
/// sent back to the API when saving a role's `permissions` array.
class PermissionItem {
  const PermissionItem({required this.id, required this.key, this.description});

  final String id;
  final String key;
  final String? description;

  factory PermissionItem.fromJson(Map<String, dynamic> json) =>
      PermissionItem(
        id: json['id'] as String,
        key: json['key'] as String,
        description: json['description'] as String?,
      );
}

/// Mirrors one entry of `GET /permissions`'s `groups` array — the registry
/// used to build the permission-tree picker on the role form.
class PermissionGroup {
  const PermissionGroup({required this.resource, required this.permissions});

  final String resource;
  final List<PermissionItem> permissions;

  factory PermissionGroup.fromJson(Map<String, dynamic> json) =>
      PermissionGroup(
        resource: json['resource'] as String,
        permissions: (json['permissions'] as List)
            .map((e) => PermissionItem.fromJson(e as Map<String, dynamic>))
            .toList(),
      );
}
