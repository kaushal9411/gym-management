import 'package:flutter_test/flutter_test.dart';
import 'package:gym_saas_mobile/models/announcement_stats.dart';
import 'package:gym_saas_mobile/models/notification_stats.dart';

// Fixtures are derived from the backend DTOs (`NotificationStatsDto`,
// `AnnouncementStatsDto`) and their assemble*Stats util specs — not from a
// live response.
void main() {
  test('NotificationStats parses the DTO shape', () {
    final s = NotificationStats.fromJson({
      'range': {'from': '2026-10-01', 'to': '2026-10-02'},
      'previousRange': {'from': '2026-09-29', 'to': '2026-09-30'},
      'kpis': {
        'total': {'value': 10, 'previous': 5},
        'unread': {'value': 4},
        'read': {'value': 6, 'previous': 5},
        'readRate': {'value': 0.6, 'previous': 1},
      },
      'daily': [
        {'date': '2026-10-01', 'total': 6, 'read': 4, 'previousTotal': 5},
        {'date': '2026-10-02', 'total': 4, 'read': 2, 'previousTotal': 0},
      ],
      'categories': [
        {'category': 'PAYMENT', 'count': 7, 'unread': 3, 'previousCount': 0},
        {'category': 'MEMBER', 'count': 3, 'unread': 1, 'previousCount': 5},
      ],
      'hourly': [
        for (var h = 0; h < 24; h++) {'hour': h, 'count': h == 9 ? 8 : 0},
      ],
    });
    expect(s.total.deltaPercent, 100);
    expect(s.unread, 4);
    expect(s.readRate.value, 0.6);
    expect(s.readRate.previous, 1.0);
    expect(s.daily.last.previousTotal, 0);
    expect(s.categories.first.deltaPercent, isNull);
    expect(s.categories.last.deltaPercent, -40);
    expect(s.busiestHour?.hour, 9);
  });

  test('NotificationStats tolerates an empty / malformed payload', () {
    final s = NotificationStats.fromJson({'kpis': 'oops', 'daily': 3});
    expect(s.total.value, 0);
    expect(s.unread, 0);
    expect(s.daily, isEmpty);
    expect(s.busiestHour, isNull);
  });

  test('NotificationCounts.tryParse', () {
    expect(NotificationCounts.tryParse(null), isNull);
    final c = NotificationCounts.tryParse({'all': 12, 'unread': 3})!;
    expect(c.all, 12);
    expect(c.unread, 3);
  });

  test('AnnouncementStats parses the DTO shape incl. null delivered/read', () {
    final s = AnnouncementStats.fromJson({
      'range': {'from': '2026-10-01', 'to': '2026-10-02'},
      'previousRange': {'from': '2026-09-29', 'to': '2026-09-30'},
      'kpis': {
        'published': {'value': 3, 'previous': 2},
        'drafts': {'value': 1},
        'scheduled': {'value': 2},
        'expired': {'value': 4},
        'expiringSoon': {'value': 1},
      },
      'daily': [
        {'date': '2026-10-01', 'published': 2, 'previousPublished': 1},
      ],
      'byStatus': [
        {'status': 'DRAFT', 'count': 1},
        {'status': 'PUBLISHED', 'count': 3},
      ],
      'byAudience': [
        {'audience': 'ALL', 'count': 2, 'previousCount': 0},
        {'audience': 'STAFF', 'count': 1, 'previousCount': 2},
      ],
      'byBranch': [
        {'branchId': 'b1', 'name': 'Main', 'count': 2},
      ],
      'upcoming': [
        {
          'id': 'a1',
          'title': 'Sale',
          'audience': 'MEMBERS',
          'publishAt': '2026-10-05T10:00:00.000Z',
        },
      ],
      'expiring': [
        {
          'id': 'a2',
          'title': 'Promo',
          'audience': 'ALL',
          'expiresAt': null,
        },
      ],
      'recent': [
        {
          'id': 'a3',
          'title': 'Closed',
          'audience': 'ALL',
          'publishedAt': '2026-10-01T08:00:00.000Z',
          'delivered': null,
          'read': null,
        },
        {
          'id': 'a4',
          'title': 'Reach',
          'audience': 'ALL',
          'publishedAt': null,
          'delivered': 10,
          'read': 4,
        },
      ],
    });
    expect(s.published.deltaPercent, 50);
    expect(s.drafts, 1);
    expect(s.expiringSoon, 1);
    expect(s.byAudience.first.deltaPercent, isNull);
    expect(s.byAudience.last.deltaPercent, -50);
    expect(s.byBranch.single.name, 'Main');
    expect(s.upcoming.single.publishAt, isNotNull);
    expect(s.expiring.single.expiresAt, isNull);
    expect(s.recent.first.delivered, isNull);
    expect(s.recent.first.hasReach, isFalse);
    expect(s.recent.last.hasReach, isTrue);
    expect(s.recent.last.read, 4);
  });

  test('AnnouncementCounts.tryParse', () {
    expect(AnnouncementCounts.tryParse('x'), isNull);
    final c = AnnouncementCounts.tryParse({
      'all': 9,
      'draft': 1,
      'scheduled': 2,
      'published': 5,
      'expired': 1,
    })!;
    expect(c.published, 5);
    expect(c.all, 9);
  });
}
