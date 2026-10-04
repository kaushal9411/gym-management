import 'payments_analytics.dart';

/// Mirrors `TicketStatsDto` (`GET /support/tickets/stats`, perm
/// `support:view`; `apps/api/src/modules/support/utils/ticket-stats.util.ts`).
/// Counts are numbers, dates `YYYY-MM-DD`. Only `created` follows the period
/// chips (with a previous-range baseline); open / in-progress / resolved /
/// closed / unresolved / byStatus are current-state. `oldestOpenDays` is null
/// when nothing is unresolved — never defaulted to 0.
class SupportTicketStats {
  const SupportTicketStats({
    required this.range,
    required this.previousRange,
    required this.created,
    required this.open,
    required this.inProgress,
    required this.resolved,
    required this.closed,
    required this.unresolved,
    required this.oldestOpenDays,
    required this.daily,
    required this.byStatus,
    required this.byPriority,
  });

  final AnalyticsRange range;
  final AnalyticsRange previousRange;
  final ValueVsPrevious created;
  final int open;
  final int inProgress;
  final int resolved;
  final int closed;
  final int unresolved;
  final int? oldestOpenDays;
  final List<TicketDay> daily;
  final List<TicketStatusStat> byStatus;
  final List<TicketPriorityStat> byPriority;

  factory SupportTicketStats.fromJson(Map<String, dynamic> j) {
    final k = jsonMap(j['kpis']);
    int v(String key) => jsonInt(jsonMap(k[key])['value']);
    final oldest = k['oldestOpenDays'];
    return SupportTicketStats(
      range: AnalyticsRange.fromJson(jsonMap(j['range'])),
      previousRange: AnalyticsRange.fromJson(jsonMap(j['previousRange'])),
      created: ValueVsPrevious.fromJson(jsonMap(k['created'])),
      open: v('open'),
      inProgress: v('inProgress'),
      resolved: v('resolved'),
      closed: v('closed'),
      unresolved: v('unresolved'),
      oldestOpenDays: oldest is Map<String, dynamic> && oldest['value'] != null
          ? jsonInt(oldest['value'])
          : null,
      daily: jsonList(j['daily']).map(TicketDay.fromJson).toList(),
      byStatus: jsonList(j['byStatus']).map(TicketStatusStat.fromJson).toList(),
      byPriority:
          jsonList(j['byPriority']).map(TicketPriorityStat.fromJson).toList(),
    );
  }
}

class TicketDay {
  const TicketDay({
    required this.date,
    required this.created,
    required this.previousCreated,
  });

  final String date;
  final int created;
  final int previousCreated;

  factory TicketDay.fromJson(Map<String, dynamic> j) => TicketDay(
        date: j['date'] as String? ?? '',
        created: jsonInt(j['created']),
        previousCreated: jsonInt(j['previousCreated']),
      );
}

class TicketStatusStat {
  const TicketStatusStat({required this.status, required this.count});

  final String status;
  final int count;

  factory TicketStatusStat.fromJson(Map<String, dynamic> j) => TicketStatusStat(
        status: j['status'] as String? ?? '',
        count: jsonInt(j['count']),
      );
}

class TicketPriorityStat {
  const TicketPriorityStat({
    required this.priority,
    required this.count,
    required this.previousCount,
  });

  final String priority;
  final int count;
  final int previousCount;

  double? get deltaPercent =>
      previousCount > 0 ? (count - previousCount) / previousCount * 100 : null;

  factory TicketPriorityStat.fromJson(Map<String, dynamic> j) =>
      TicketPriorityStat(
        priority: j['priority'] as String? ?? '',
        count: jsonInt(j['count']),
        previousCount: jsonInt(j['previousCount']),
      );
}

/// `counts` block on `GET /support/tickets` (status chip badges; tenant-wide,
/// ignores the status filter).
class SupportTicketCounts {
  const SupportTicketCounts({
    required this.all,
    required this.open,
    required this.inProgress,
    required this.resolved,
    required this.closed,
  });

  final int all;
  final int open;
  final int inProgress;
  final int resolved;
  final int closed;

  static SupportTicketCounts? tryParse(Object? v) {
    if (v is! Map<String, dynamic>) return null;
    return SupportTicketCounts(
      all: jsonInt(v['all']),
      open: jsonInt(v['open']),
      inProgress: jsonInt(v['inProgress']),
      resolved: jsonInt(v['resolved']),
      closed: jsonInt(v['closed']),
    );
  }
}
