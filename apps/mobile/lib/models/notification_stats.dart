import 'payments_analytics.dart';

/// Mirrors `NotificationStatsDto` (`GET /notifications/stats`, perm
/// `notifications:view`). Counts are plain numbers, `readRate` is 0..1,
/// dates are `YYYY-MM-DD` (UTC days). Parsing is defensive — a missing or
/// malformed block degrades to 0/empty rather than throwing.
///
/// NB: the staff feed's `readAt` is tenant-wide (shared by all staff), so
/// "unread"/"read" here are feed-level, not per-user.
class NotificationStats {
  const NotificationStats({
    required this.range,
    required this.previousRange,
    required this.total,
    required this.unread,
    required this.read,
    required this.readRate,
    required this.daily,
    required this.categories,
    required this.hourly,
  });

  final AnalyticsRange range;
  final AnalyticsRange previousRange;
  final ValueVsPrevious total;
  final int unread;
  final ValueVsPrevious read;

  /// 0..1 ratio, this period vs the previous one.
  final ValueVsPrevious readRate;
  final List<NotificationDay> daily;
  final List<NotificationCategoryStat> categories;

  /// UTC hour buckets (the API always sends all 24; sparse is tolerated).
  final List<NotificationHour> hourly;

  /// The hour with the most notifications, or null when there are none.
  NotificationHour? get busiestHour {
    NotificationHour? best;
    for (final h in hourly) {
      if (h.count > 0 && (best == null || h.count > best.count)) best = h;
    }
    return best;
  }

  factory NotificationStats.fromJson(Map<String, dynamic> j) {
    final k = jsonMap(j['kpis']);
    return NotificationStats(
      range: AnalyticsRange.fromJson(jsonMap(j['range'])),
      previousRange: AnalyticsRange.fromJson(jsonMap(j['previousRange'])),
      total: ValueVsPrevious.fromJson(jsonMap(k['total'])),
      unread: jsonInt(jsonMap(k['unread'])['value']),
      read: ValueVsPrevious.fromJson(jsonMap(k['read'])),
      readRate: ValueVsPrevious.fromJson(jsonMap(k['readRate'])),
      daily: jsonList(j['daily']).map(NotificationDay.fromJson).toList(),
      categories: jsonList(j['categories'])
          .map(NotificationCategoryStat.fromJson)
          .toList(),
      hourly: jsonList(j['hourly']).map(NotificationHour.fromJson).toList(),
    );
  }
}

class NotificationDay {
  const NotificationDay({
    required this.date,
    required this.total,
    required this.read,
    required this.previousTotal,
  });

  final String date;
  final int total;
  final int read;
  final int previousTotal;

  factory NotificationDay.fromJson(Map<String, dynamic> j) => NotificationDay(
        date: j['date'] as String? ?? '',
        total: jsonInt(j['total']),
        read: jsonInt(j['read']),
        previousTotal: jsonInt(j['previousTotal']),
      );
}

class NotificationCategoryStat {
  const NotificationCategoryStat({
    required this.category,
    required this.count,
    required this.unread,
    required this.previousCount,
  });

  final String category;
  final int count;
  final int unread;
  final int previousCount;

  /// Null when there is no previous baseline — never a fake "+100%".
  double? get deltaPercent =>
      previousCount > 0 ? (count - previousCount) / previousCount * 100 : null;

  factory NotificationCategoryStat.fromJson(Map<String, dynamic> j) =>
      NotificationCategoryStat(
        category: j['category'] as String? ?? '',
        count: jsonInt(j['count']),
        unread: jsonInt(j['unread']),
        previousCount: jsonInt(j['previousCount']),
      );
}

class NotificationHour {
  const NotificationHour({required this.hour, required this.count});

  final int hour;
  final int count;

  factory NotificationHour.fromJson(Map<String, dynamic> j) =>
      NotificationHour(hour: jsonInt(j['hour']), count: jsonInt(j['count']));
}

/// `counts` block on `GET /notifications`: `all` rows / `unread` rows.
class NotificationCounts {
  const NotificationCounts({required this.all, required this.unread});

  final int all;
  final int unread;

  static NotificationCounts? tryParse(Object? v) {
    if (v is! Map<String, dynamic>) return null;
    return NotificationCounts(
      all: jsonInt(v['all']),
      unread: jsonInt(v['unread']),
    );
  }
}
