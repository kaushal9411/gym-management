/// Mirrors `SessionDto` (`GET /auth/sessions`).
class UserSession {
  const UserSession({
    required this.id,
    required this.deviceLabel,
    required this.ipAddress,
    required this.userAgent,
    required this.lastActiveAt,
    required this.isCurrent,
  });

  final String id;
  final String? deviceLabel;
  final String? ipAddress;
  final String? userAgent;
  final DateTime lastActiveAt;
  final bool isCurrent;

  factory UserSession.fromJson(Map<String, dynamic> json) => UserSession(
        id: json['id'] as String,
        deviceLabel: json['deviceLabel'] as String?,
        ipAddress: json['ipAddress'] as String?,
        userAgent: json['userAgent'] as String?,
        lastActiveAt: DateTime.parse(json['lastActiveAt'] as String),
        isCurrent: json['isCurrent'] as bool? ?? false,
      );
}
