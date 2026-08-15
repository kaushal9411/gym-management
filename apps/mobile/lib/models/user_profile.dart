/// Mirrors `UserProfileDto` (staff plane — `/auth/login`, `/auth/me`).
class UserProfile {
  const UserProfile({
    required this.id,
    required this.tenantId,
    required this.name,
    required this.email,
    required this.phone,
    this.avatarUrl,
    required this.status,
    required this.roles,
    required this.permissions,
  });

  final String id;
  final String tenantId;
  final String name;
  final String email;
  final String? phone;
  final String? avatarUrl;
  final String status;
  final List<String> roles;
  final List<String> permissions;

  bool hasPermission(String key) => permissions.contains(key);

  bool hasAnyPermission(List<String> keys) => keys.any(permissions.contains);

  bool get isOwner => roles.contains('OWNER');
  bool get isManager => roles.contains('MANAGER');
  bool get isTrainer => roles.contains('TRAINER');
  bool get isReceptionist => roles.contains('RECEPTIONIST');

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

  factory UserProfile.fromJson(Map<String, dynamic> json) => UserProfile(
        id: json['id'] as String,
        tenantId: json['tenantId'] as String? ?? '',
        name: json['name'] as String? ?? '',
        email: json['email'] as String? ?? '',
        phone: json['phone'] as String?,
        avatarUrl: json['avatarUrl'] as String?,
        status: json['status'] as String? ?? '',
        roles: (json['roles'] as List?)?.cast<String>() ?? const [],
        permissions: (json['permissions'] as List?)?.cast<String>() ?? const [],
      );
}
