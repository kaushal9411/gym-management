import 'package:flutter_test/flutter_test.dart';
import 'package:gym_saas_mobile/models/support_ticket_stats.dart';

// Fixtures derived from apps/api/.../support/utils/ticket-stats.util.ts
// (TicketStatsDto / assembleTicketCounts), not a live response.
void main() {
  Map<String, dynamic> base({Object? oldest}) => {
        'range': {'from': '2026-10-01', 'to': '2026-10-02'},
        'previousRange': {'from': '2026-09-29', 'to': '2026-09-30'},
        'kpis': {
          'created': {'value': 5, 'previous': 2},
          'open': {'value': 3},
          'inProgress': {'value': 1},
          'resolved': {'value': 2},
          'closed': {'value': 7},
          'unresolved': {'value': 4},
          'oldestOpenDays': oldest,
        },
        'daily': [
          {'date': '2026-10-01', 'created': 3, 'previousCreated': 1},
          {'date': '2026-10-02', 'created': 2, 'previousCreated': 1},
        ],
        'byStatus': [
          {'status': 'OPEN', 'count': 3},
          {'status': 'CLOSED', 'count': 7},
        ],
        'byPriority': [
          {'priority': 'HIGH', 'count': 4, 'previousCount': 2},
          {'priority': 'LOW', 'count': 1, 'previousCount': 0},
        ],
      };

  test('parses full stats', () {
    final s = SupportTicketStats.fromJson(base(oldest: {'value': 9}));
    expect(s.created.value, 5);
    expect(s.created.deltaPercent, 150);
    expect(s.unresolved, 4);
    expect(s.oldestOpenDays, 9);
    expect(s.daily.last.previousCreated, 1);
    expect(s.byStatus.first.status, 'OPEN');
    expect(s.byPriority.first.deltaPercent, 100);
    expect(s.byPriority.last.deltaPercent, isNull);
  });

  test('oldestOpenDays null stays null; empty payload does not throw', () {
    expect(SupportTicketStats.fromJson(base()).oldestOpenDays, isNull);
    final e = SupportTicketStats.fromJson({});
    expect(e.oldestOpenDays, isNull);
    expect(e.daily, isEmpty);
    expect(e.open, 0);
  });

  test('counts block', () {
    final c = SupportTicketCounts.tryParse(
      {'all': 13, 'open': 3, 'inProgress': 1, 'resolved': 2, 'closed': 7},
    )!;
    expect(c.all, 13);
    expect(c.inProgress, 1);
    expect(SupportTicketCounts.tryParse(null), isNull);
  });
}
