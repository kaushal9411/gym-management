/// Mirrors `LoginHistoryEntry` (`GET /sessions/login-history`).
class LoginHistoryEntry {
  const LoginHistoryEntry({
    required this.id,
    required this.success,
    required this.reason,
    required this.ipAddress,
    required this.userAgent,
    required this.createdAt,
  });

  final String id;
  final bool success;
  final String? reason;
  final String? ipAddress;
  final String? userAgent;
  final DateTime createdAt;

  factory LoginHistoryEntry.fromJson(Map<String, dynamic> json) =>
      LoginHistoryEntry(
        id: json['id'] as String,
        success: json['success'] as bool? ?? false,
        reason: json['reason'] as String?,
        ipAddress: json['ipAddress'] as String?,
        userAgent: json['userAgent'] as String?,
        createdAt: DateTime.parse(json['createdAt'] as String),
      );
}
