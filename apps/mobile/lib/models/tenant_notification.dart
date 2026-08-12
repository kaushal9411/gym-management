/// Mirrors the `TenantNotification` row shape returned by `GET /notifications`.
class TenantNotification {
  const TenantNotification({
    required this.id,
    required this.category,
    required this.title,
    required this.body,
    required this.readAt,
    required this.createdAt,
  });

  final String id;
  final String category;
  final String title;
  final String body;
  final DateTime? readAt;
  final DateTime createdAt;

  bool get isUnread => readAt == null;

  factory TenantNotification.fromJson(Map<String, dynamic> json) =>
      TenantNotification(
        id: json['id'] as String,
        category: json['category'] as String,
        title: json['title'] as String,
        body: json['body'] as String,
        readAt: json['readAt'] == null
            ? null
            : DateTime.parse(json['readAt'] as String),
        createdAt: DateTime.parse(json['createdAt'] as String),
      );
}
