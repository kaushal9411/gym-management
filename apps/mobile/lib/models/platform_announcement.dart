/// Mirrors the platform-plane `Announcement` (`GET /announcements/active`)
/// — Super Admin-authored notices broadcast to tenants (e.g. "New feature
/// released"), distinct from `Announcement` (`tenant_announcements`), which
/// tenant staff author for their own members/staff.
class PlatformAnnouncement {
  const PlatformAnnouncement({
    required this.id,
    required this.title,
    required this.body,
    required this.publishedAt,
  });

  final String id;
  final String title;
  final String body;
  final DateTime? publishedAt;

  factory PlatformAnnouncement.fromJson(Map<String, dynamic> json) =>
      PlatformAnnouncement(
        id: json['id'] as String,
        title: json['title'] as String,
        body: json['body'] as String,
        publishedAt: json['publishedAt'] == null
            ? null
            : DateTime.parse(json['publishedAt'] as String),
      );
}
