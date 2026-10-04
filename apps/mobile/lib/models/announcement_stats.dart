import 'payments_analytics.dart';

int? _nullableInt(Object? v) => v == null ? null : jsonInt(v);

/// Mirrors `AnnouncementStatsDto` (`GET /tenant-announcements/stats`, perm
/// `announcements:view`). Counts are numbers, dates `YYYY-MM-DD`; the
/// `upcoming/expiring/recent` timestamps are ISO instants (nullable).
/// `recent[].delivered/read` are always null today (the backend cannot link
/// member notifications back to an announcement) — kept nullable so the UI
/// shows bars only when the API starts sending them.
class AnnouncementStats {
  const AnnouncementStats({
    required this.range,
    required this.previousRange,
    required this.published,
    required this.drafts,
    required this.scheduled,
    required this.expired,
    required this.expiringSoon,
    required this.daily,
    required this.byStatus,
    required this.byAudience,
    required this.byBranch,
    required this.upcoming,
    required this.expiring,
    required this.recent,
  });

  final AnalyticsRange range;
  final AnalyticsRange previousRange;
  final ValueVsPrevious published;
  final int drafts;
  final int scheduled;
  final int expired;
  final int expiringSoon;
  final List<AnnouncementDay> daily;
  final List<AnnouncementStatusStat> byStatus;
  final List<AnnouncementAudienceStat> byAudience;
  final List<AnnouncementBranchStat> byBranch;
  final List<AnnouncementUpcoming> upcoming;
  final List<AnnouncementExpiring> expiring;
  final List<AnnouncementRecent> recent;

  factory AnnouncementStats.fromJson(Map<String, dynamic> j) {
    final k = jsonMap(j['kpis']);
    return AnnouncementStats(
      range: AnalyticsRange.fromJson(jsonMap(j['range'])),
      previousRange: AnalyticsRange.fromJson(jsonMap(j['previousRange'])),
      published: ValueVsPrevious.fromJson(jsonMap(k['published'])),
      drafts: jsonInt(jsonMap(k['drafts'])['value']),
      scheduled: jsonInt(jsonMap(k['scheduled'])['value']),
      expired: jsonInt(jsonMap(k['expired'])['value']),
      expiringSoon: jsonInt(jsonMap(k['expiringSoon'])['value']),
      daily: jsonList(j['daily']).map(AnnouncementDay.fromJson).toList(),
      byStatus:
          jsonList(j['byStatus']).map(AnnouncementStatusStat.fromJson).toList(),
      byAudience: jsonList(j['byAudience'])
          .map(AnnouncementAudienceStat.fromJson)
          .toList(),
      byBranch:
          jsonList(j['byBranch']).map(AnnouncementBranchStat.fromJson).toList(),
      upcoming:
          jsonList(j['upcoming']).map(AnnouncementUpcoming.fromJson).toList(),
      expiring:
          jsonList(j['expiring']).map(AnnouncementExpiring.fromJson).toList(),
      recent: jsonList(j['recent']).map(AnnouncementRecent.fromJson).toList(),
    );
  }
}

class AnnouncementDay {
  const AnnouncementDay({
    required this.date,
    required this.published,
    required this.previousPublished,
  });

  final String date;
  final int published;
  final int previousPublished;

  factory AnnouncementDay.fromJson(Map<String, dynamic> j) => AnnouncementDay(
        date: j['date'] as String? ?? '',
        published: jsonInt(j['published']),
        previousPublished: jsonInt(j['previousPublished']),
      );
}

class AnnouncementStatusStat {
  const AnnouncementStatusStat({required this.status, required this.count});

  final String status;
  final int count;

  factory AnnouncementStatusStat.fromJson(Map<String, dynamic> j) =>
      AnnouncementStatusStat(
        status: j['status'] as String? ?? '',
        count: jsonInt(j['count']),
      );
}

class AnnouncementAudienceStat {
  const AnnouncementAudienceStat({
    required this.audience,
    required this.count,
    required this.previousCount,
  });

  final String audience;
  final int count;
  final int previousCount;

  double? get deltaPercent =>
      previousCount > 0 ? (count - previousCount) / previousCount * 100 : null;

  factory AnnouncementAudienceStat.fromJson(Map<String, dynamic> j) =>
      AnnouncementAudienceStat(
        audience: j['audience'] as String? ?? '',
        count: jsonInt(j['count']),
        previousCount: jsonInt(j['previousCount']),
      );
}

class AnnouncementBranchStat {
  const AnnouncementBranchStat({
    required this.branchId,
    required this.name,
    required this.count,
  });

  final String branchId;
  final String name;
  final int count;

  factory AnnouncementBranchStat.fromJson(Map<String, dynamic> j) =>
      AnnouncementBranchStat(
        branchId: j['branchId'] as String? ?? '',
        name: j['name'] as String? ?? '',
        count: jsonInt(j['count']),
      );
}

class AnnouncementUpcoming {
  const AnnouncementUpcoming({
    required this.id,
    required this.title,
    required this.audience,
    required this.publishAt,
  });

  final String id;
  final String title;
  final String audience;
  final String? publishAt;

  factory AnnouncementUpcoming.fromJson(Map<String, dynamic> j) =>
      AnnouncementUpcoming(
        id: j['id'] as String? ?? '',
        title: j['title'] as String? ?? '',
        audience: j['audience'] as String? ?? '',
        publishAt: j['publishAt'] as String?,
      );
}

class AnnouncementExpiring {
  const AnnouncementExpiring({
    required this.id,
    required this.title,
    required this.audience,
    required this.expiresAt,
  });

  final String id;
  final String title;
  final String audience;
  final String? expiresAt;

  factory AnnouncementExpiring.fromJson(Map<String, dynamic> j) =>
      AnnouncementExpiring(
        id: j['id'] as String? ?? '',
        title: j['title'] as String? ?? '',
        audience: j['audience'] as String? ?? '',
        expiresAt: j['expiresAt'] as String?,
      );
}

class AnnouncementRecent {
  const AnnouncementRecent({
    required this.id,
    required this.title,
    required this.audience,
    required this.publishedAt,
    required this.delivered,
    required this.read,
  });

  final String id;
  final String title;
  final String audience;
  final String? publishedAt;

  /// Null when the backend cannot attribute deliveries to this announcement.
  final int? delivered;
  final int? read;

  bool get hasReach => delivered != null && read != null;

  factory AnnouncementRecent.fromJson(Map<String, dynamic> j) =>
      AnnouncementRecent(
        id: j['id'] as String? ?? '',
        title: j['title'] as String? ?? '',
        audience: j['audience'] as String? ?? '',
        publishedAt: j['publishedAt'] as String?,
        delivered: _nullableInt(j['delivered']),
        read: _nullableInt(j['read']),
      );
}

/// `counts` block on `GET /tenant-announcements` (status tab badges).
class AnnouncementCounts {
  const AnnouncementCounts({
    required this.all,
    required this.draft,
    required this.scheduled,
    required this.published,
    required this.expired,
  });

  final int all;
  final int draft;
  final int scheduled;
  final int published;
  final int expired;

  static AnnouncementCounts? tryParse(Object? v) {
    if (v is! Map<String, dynamic>) return null;
    return AnnouncementCounts(
      all: jsonInt(v['all']),
      draft: jsonInt(v['draft']),
      scheduled: jsonInt(v['scheduled']),
      published: jsonInt(v['published']),
      expired: jsonInt(v['expired']),
    );
  }
}
