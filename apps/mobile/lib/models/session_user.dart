/// The authenticated staff user + their effective permission set — the
/// mobile equivalent of tenant-web's Redux `auth` slice payload.
class SessionUser {
  final String id;
  final String name;
  final String email;
  final List<String> roles;
  final List<String> permissions;

  const SessionUser({
    required this.id,
    required this.name,
    required this.email,
    required this.roles,
    required this.permissions,
  });

  bool can(String permissionKey) => permissions.contains(permissionKey);

  factory SessionUser.fromJson(Map<String, dynamic> json) {
    return SessionUser(
      id: json['id'] as String,
      name: json['name'] as String? ?? '',
      email: json['email'] as String? ?? '',
      roles: (json['roles'] as List?)?.map((e) => e.toString()).toList() ??
          const [],
      permissions:
          (json['permissions'] as List?)?.map((e) => e.toString()).toList() ??
              const [],
    );
  }

  String get initials {
    final parts = name.trim().split(RegExp(r'\s+'));
    if (parts.isEmpty || parts.first.isEmpty) return '?';
    if (parts.length == 1) return parts.first.substring(0, 1).toUpperCase();
    return (parts.first.substring(0, 1) + parts.last.substring(0, 1))
        .toUpperCase();
  }
}
