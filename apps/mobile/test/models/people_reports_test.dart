import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gym_saas_mobile/core/network/api_exception.dart';
import 'package:gym_saas_mobile/features/reports/presentation/kit/kit.dart';
import 'package:gym_saas_mobile/features/reports/presentation/people/people_report_page.dart';
import 'package:gym_saas_mobile/features/reports/presentation/people/people_ui.dart';
import 'package:gym_saas_mobile/models/active_vs_inactive_row.dart';
import 'package:gym_saas_mobile/models/attendance_report_row.dart';
import 'package:gym_saas_mobile/models/expiring_membership_row.dart';
import 'package:gym_saas_mobile/models/member_progress_row.dart';
import 'package:gym_saas_mobile/models/paginated_result.dart';
import 'package:gym_saas_mobile/models/trainer_performance_row.dart';

PaginatedResult<int> _page(int page, int totalPages, List<int> items) =>
    PaginatedResult(
      items: items,
      total: 5,
      page: page,
      limit: 2,
      totalPages: totalPages,
    );

void main() {
  group('report row models', () {
    test('attendance row: times become local, duration is out - in', () {
      final r = AttendanceReportRow.fromJson({
        'date': '2026-10-18',
        'memberCode': 'M-001',
        'name': 'Asha Rao',
        'branch': 'Main',
        'checkInTime': '2026-10-18T01:00:00.000Z',
        'checkOutTime': '2026-10-18T02:23:00.000Z',
        'method': 'QR_CODE',
      });
      expect(r.date, '2026-10-18'); // date-only value is never shifted
      expect(r.checkIn!.isUtc, isFalse);
      expect(r.duration, const Duration(hours: 1, minutes: 23));
      expect(r.method, 'QR_CODE');
    });

    test('attendance row: no check-out -> no duration; bad data is safe', () {
      final r = AttendanceReportRow.fromJson({
        'date': '2026-10-18',
        'memberCode': 'M-001',
        'name': 'A',
        'branch': 'B',
        'checkInTime': '2026-10-18T01:00:00.000Z',
        'checkOutTime': null,
        'method': 'MANUAL',
      });
      expect(r.checkOut, isNull);
      expect(r.duration, isNull);
      final inverted = AttendanceReportRow.fromJson({
        'checkInTime': '2026-10-18T05:00:00.000Z',
        'checkOutTime': '2026-10-18T04:00:00.000Z',
      });
      expect(inverted.duration, isNull);
      final empty = AttendanceReportRow.fromJson(const {});
      expect(empty.checkIn, isNull);
      expect(empty.method, 'MANUAL');
    });

    test('member progress: null stays null, 0 stays 0, numbers may be text',
        () {
      final r = MemberProgressRow.fromJson({
        'memberCode': 'M-2',
        'name': 'B',
        'workoutPlan': 'Push Pull',
        'workoutProgressPercent': '42',
        'dietPlan': null,
        'dietProgressPercent': null,
      });
      expect(r.workoutProgressPercent, 42);
      expect(r.dietProgressPercent, isNull);
      final zero = MemberProgressRow.fromJson({
        'memberCode': 'M-3',
        'name': 'C',
        'workoutProgressPercent': 0,
      });
      expect(zero.workoutProgressPercent, 0);
    });

    test('expiring / trainer / status rows parse num-ish ints', () {
      final e = ExpiringMembershipRow.fromJson({
        'memberCode': 'M-1',
        'name': 'A',
        'branch': 'B',
        'plan': 'Gold',
        'endDate': '2026-11-02',
        'daysRemaining': 15.0,
      });
      expect(e.daysRemaining, 15);
      expect(e.endDate, '2026-11-02');
      final t = TrainerPerformanceRow.fromJson({
        'trainerId': 't',
        'name': 'T',
        'assignedMembers': '7',
        'activeWorkoutPlans': 3,
        'activeDietPlans': null,
      });
      expect(t.assignedMembers, 7);
      expect(t.activeDietPlans, 0);
      expect(
        ActiveVsInactiveRow.fromJson({'status': 'ACTIVE', 'count': 9}).count,
        9,
      );
    });
  });

  group('formatters', () {
    test('peopleDate never shifts the day', () {
      expect(peopleDate('2026-11-14'), '14 Nov 2026');
      expect(peopleDate('2026-01-01T00:00:00.000Z'), '1 Jan 2026');
      expect(peopleDate(null), '—');
      expect(peopleDate('bad'), '—');
      expect(peopleDate('2026-13-01'), '—');
    });

    test('peopleDuration / peopleTime', () {
      expect(peopleDuration(const Duration(hours: 1, minutes: 5)), '1h 5m');
      expect(peopleDuration(const Duration(minutes: 45)), '45m');
      expect(peopleDuration(const Duration(seconds: 20)), '<1m');
      expect(peopleTime(DateTime(2026, 10, 18, 6, 5)), '6:05 AM');
      expect(peopleTime(DateTime(2026, 10, 18, 0, 0)), '12:00 AM');
      expect(peopleTime(DateTime(2026, 10, 18, 13, 30)), '1:30 PM');
      expect(peopleTime(null), '—');
    });

    test('peopleDaysUntil counts whole calendar days', () {
      final now = DateTime(2026, 10, 18, 23, 59);
      expect(peopleDaysUntil('2026-10-18', now: now), 0);
      expect(peopleDaysUntil('2026-10-25', now: now), 7);
      expect(peopleDaysUntil('2026-10-17', now: now), -1);
      expect(peopleDaysUntil(null, now: now), isNull);
    });
  });

  group('palettes', () {
    test('urgency follows web (<= 7 rose, <= 14 amber, else green)', () {
      expect(peopleUrgencyColor(0), RptColors.rose);
      expect(peopleUrgencyColor(7), RptColors.rose);
      expect(peopleUrgencyColor(8), RptColors.amber);
      expect(peopleUrgencyColor(14), RptColors.amber);
      expect(peopleUrgencyColor(15), RptColors.green);
    });

    test('progress follows web (>= 70 green, >= 35 amber, else rose)', () {
      expect(peopleProgressColor(70), RptColors.green);
      expect(peopleProgressColor(69), RptColors.amber);
      expect(peopleProgressColor(35), RptColors.amber);
      expect(peopleProgressColor(34), RptColors.rose);
    });

    test('status colours and breakdown hooks', () {
      expect(peopleStatusColor('active'), RptColors.green);
      expect(peopleStatusColor('EXPIRED'), RptColors.rose);
      expect(peopleStatusColor('FROZEN'), RptColors.sky);
      expect(peopleBreakdownColor('by-status', 'ACTIVE'), RptColors.green);
      expect(peopleBreakdownColor('by-plan', 'Gold'), isNull);
      expect(peopleBreakdownLabel('by-status', 'ACTIVE'), 'Active');
      expect(peopleBreakdownLabel('by-role', 'RECEPTIONIST'), 'Receptionist');
      // plan / trainer names are never re-cased
      expect(peopleBreakdownLabel('by-plan', 'VIP Gold'), 'VIP Gold');
      expect(peopleMethodLabel('QR_CODE'), 'QR code');
      expect(peopleMethodLabel('FACE_RECOGNITION'), 'Face recognition');
    });
  });

  group('PagedReport', () {
    test('loads page 1, then appends the next', () async {
      final calls = <int>[];
      final p = PagedReport<int>((page, limit) async {
        calls.add(page);
        return page == 1 ? _page(1, 2, [1, 2]) : _page(2, 2, [3]);
      });
      await p.load();
      expect(p.items, [1, 2]);
      expect(p.total, 5);
      expect(p.hasMore, isTrue);
      expect(p.loading, isFalse);
      expect(await p.loadMore(), isNull);
      expect(p.items, [1, 2, 3]);
      expect(p.hasMore, isFalse);
      expect(await p.loadMore(), isNull); // nothing more: no request
      expect(calls, [1, 2]);
    });

    test('typed and untyped failures end in a message and reset flags',
        () async {
      var n = 0;
      final p = PagedReport<int>((page, limit) async {
        n++;
        if (n == 1) {
          throw const ApiException(message: 'No access', statusCode: 403);
        }
        if (n == 2) throw StateError('boom');
        return _page(1, 1, [1]);
      });
      await p.load();
      expect(p.error, 'No access');
      expect(p.loading, isFalse);
      await p.load();
      expect(p.error, isNotNull);
      expect(p.loading, isFalse);
      await p.load();
      expect(p.error, isNull);
      expect(p.items, [1]);
    });

    test('a failed load-more keeps the rows and reports a message', () async {
      var n = 0;
      final p = PagedReport<int>((page, limit) async {
        n++;
        if (n == 2) throw StateError('x');
        return _page(1, 2, [1, 2]);
      });
      await p.load();
      final msg = await p.loadMore();
      expect(msg, isNotNull);
      expect(p.items, [1, 2]);
      expect(p.loadingMore, isFalse);
    });

    test('a superseded response is dropped', () async {
      final slow = <Future<PaginatedResult<int>> Function()>[
        () => Future.delayed(
              const Duration(milliseconds: 40),
              () => _page(1, 1, [9]),
            ),
        () async => _page(1, 1, [1]),
      ];
      var i = 0;
      final p = PagedReport<int>((page, limit) => slow[i++]());
      final first = p.load();
      final second = p.load();
      await Future.wait([first, second]);
      expect(p.items, [1]);
    });

    test('clear() empties without a request', () async {
      var calls = 0;
      final p = PagedReport<int>((page, limit) async {
        calls++;
        return _page(1, 1, [1]);
      });
      await p.load();
      p.clear();
      expect(p.items, isEmpty);
      expect(p.loading, isFalse);
      expect(calls, 1);
    });
  });

  testWidgets('hero chips come from the first numeric KPIs, else the total',
      (t) async {
    expect(peopleHeroChips(null), isEmpty);
    final fallback = peopleHeroChips(null, total: 12, noun: 'members');
    expect(fallback.length, 1);
    await t.pumpWidget(
      MaterialApp(home: Row(children: fallback)),
    );
    expect(find.text('12 members'), findsOneWidget);
  });
}
