enum AnnouncementAudience { all, members, staff }

extension AnnouncementAudienceX on AnnouncementAudience {
  String get apiValue => switch (this) {
        AnnouncementAudience.all => 'ALL',
        AnnouncementAudience.members => 'MEMBERS',
        AnnouncementAudience.staff => 'STAFF',
      };

  String get label => switch (this) {
        AnnouncementAudience.all => 'Everyone',
        AnnouncementAudience.members => 'Members',
        AnnouncementAudience.staff => 'Staff',
      };

  static AnnouncementAudience fromApi(String v) => switch (v) {
        'MEMBERS' => AnnouncementAudience.members,
        'STAFF' => AnnouncementAudience.staff,
        _ => AnnouncementAudience.all,
      };
}

/// Mirrors `TenantAnnouncement` (`GET /tenant-announcements`) — distinct
/// from the pre-existing platform-plane `/announcements` admin banner.
class Announcement {
  const Announcement({
    required this.id,
    required this.title,
    required this.body,
    required this.audience,
    required this.status,
    required this.publishedAt,
    required this.expiresAt,
    required this.createdAt,
  });

  final String id;
  final String title;
  final String body;
  final AnnouncementAudience audience;
  final String status;
  final DateTime? publishedAt;
  final DateTime? expiresAt;
  final DateTime createdAt;

  factory Announcement.fromJson(Map<String, dynamic> json) => Announcement(
        id: json['id'] as String,
        title: json['title'] as String,
        body: json['body'] as String,
        audience: AnnouncementAudienceX.fromApi(json['audience'] as String),
        status: json['status'] as String,
        publishedAt: json['publishedAt'] == null
            ? null
            : DateTime.parse(json['publishedAt'] as String),
        expiresAt: json['expiresAt'] == null
            ? null
            : DateTime.parse(json['expiresAt'] as String),
        createdAt: DateTime.parse(json['createdAt'] as String),
      );
}
