import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:get_it/get_it.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:gym_saas_mobile/core/network/api_exception.dart';
import 'package:gym_saas_mobile/features/member/presentation/member_attendance_screen.dart';
import 'package:gym_saas_mobile/features/member/presentation/member_visit_detail_screen.dart';
import 'package:gym_saas_mobile/models/member_overview.dart';
import 'package:gym_saas_mobile/models/member_visit.dart';
import 'package:gym_saas_mobile/models/paginated_result.dart';
import 'package:gym_saas_mobile/repositories/member_portal_repository.dart';
import 'package:mocktail/mocktail.dart';

import '../models/member_overview_test.dart' show fullFixture;

class _Repo extends Mock implements MemberPortalRepository {}

MemberVisit _visit(String id, DateTime day, {bool inside = false}) {
  final inAt = DateTime(day.year, day.month, day.day, 7, 30);
  return MemberVisit(
    id: id,
    branchName: 'Main',
    checkInTime: inAt,
    checkOutTime: inside ? null : inAt.add(const Duration(minutes: 75)),
    attendanceDate: DateTime(day.year, day.month, day.day),
    method: 'QR_CODE',
    status: 'PRESENT',
  );
}

PaginatedResult<MemberVisit> _page(List<MemberVisit> v, {int? total}) =>
    PaginatedResult<MemberVisit>(
      items: v,
      total: total ?? v.length,
      page: 1,
      limit: 30,
      totalPages: 1,
    );

void main() {
  setUpAll(() => GoogleFonts.config.allowRuntimeFetching = false);

  late _Repo repo;
  final now = DateTime.now();

  setUp(() {
    repo = _Repo();
    final g = GetIt.instance;
    if (g.isRegistered<MemberPortalRepository>()) {
      g.unregister<MemberPortalRepository>();
    }
    g.registerSingleton<MemberPortalRepository>(repo);
    when(() => repo.overview())
        .thenAnswer((_) async => MemberOverview.fromJson(fullFixture()));
    when(() => repo.attendance(limit: any(named: 'limit'))).thenAnswer(
      (_) async => _page([
        _visit('1', now, inside: true),
        _visit('2', now.subtract(const Duration(days: 1))),
        _visit('3', now.subtract(const Duration(days: 45))),
      ]),
    );
  });

  Future<void> pump(
    WidgetTester t, {
    Size size = const Size(360, 740),
    Widget child = const MemberAttendanceScreen(),
  }) async {
    t.view.physicalSize = size * 2;
    t.view.devicePixelRatio = 2;
    addTearDown(t.view.reset);
    final router = GoRouter(
      routes: [
        GoRoute(path: '/', builder: (_, __) => const SizedBox()),
        GoRoute(path: '/x', builder: (_, __) => child),
        GoRoute(
          path: '/member/attendance/detail',
          builder: (_, s) =>
              MemberVisitDetailScreen(visit: s.extra! as MemberVisit),
        ),
      ],
    );
    await t.pumpWidget(MaterialApp.router(routerConfig: router));
    router.push('/x');
    await t.pump();
    await t.pump(const Duration(seconds: 3));
  }

  Future<void> show(WidgetTester t, Finder f) async {
    for (var i = 0; i < 40 && f.evaluate().isEmpty; i++) {
      await t.drag(find.byType(Scrollable).first, const Offset(0, -300));
      await t.pump();
    }
    await t.ensureVisible(f.first);
    await t.pump();
  }

  testWidgets('phone 360: hero, tiles, heatmap and grouped history', (t) async {
    await pump(t);
    expect(t.takeException(), isNull);
    for (final label in [
      'This month',
      'Current streak',
      'Avg visit',
      'Busiest day',
      'Last 12 weeks',
      'Visit history',
      'Today',
      'Yesterday',
      'Checked in',
      '1h 15m',
      'Showing 3 of 3',
    ]) {
      await show(t, find.text(label));
      expect(find.text(label), findsWidgets, reason: label);
    }
    expect(t.takeException(), isNull);
  });

  testWidgets('month chips filter the history', (t) async {
    await pump(t);
    await show(t, find.text('All'));
    expect(find.text('Today'), findsWidgets);
    final older = DateTime.now().subtract(const Duration(days: 45));
    const m = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', //
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ];
    final label =
        "${m[older.month - 1]} '${older.year.toString().substring(2)}";
    await t.tap(find.text(label));
    await t.pump();
    expect(find.text('Today'), findsNothing);
  });

  testWidgets('Load more asks for a bigger page', (t) async {
    when(() => repo.attendance(limit: any(named: 'limit'))).thenAnswer(
      (_) async => _page([_visit('1', now)], total: 50),
    );
    await pump(t);
    await show(t, find.byKey(const ValueKey('att-more')));
    await t.tap(find.byKey(const ValueKey('att-more')));
    await t.pump();
    verify(() => repo.attendance(limit: 60)).called(1);
  });

  testWidgets('a failing overview keeps the history', (t) async {
    when(() => repo.overview())
        .thenAnswer((_) async => throw ApiException.network());
    await pump(t);
    expect(find.text('Current streak'), findsNothing);
    await show(t, find.text('Visit history'));
    expect(find.text('Yesterday'), findsWidgets);
    expect(t.takeException(), isNull);
  });

  testWidgets('no visits: empty state', (t) async {
    when(() => repo.attendance(limit: any(named: 'limit')))
        .thenAnswer((_) async => _page([]));
    await pump(t);
    await show(t, find.text('No visits yet'));
    expect(find.text('No visits yet'), findsOneWidget);
  });

  testWidgets('a load error shows retry', (t) async {
    when(() => repo.attendance(limit: any(named: 'limit')))
        .thenAnswer((_) async => throw ApiException.network());
    await pump(t);
    expect(find.text('Try again'), findsOneWidget);
  });

  testWidgets('tapping a visit opens its detail', (t) async {
    await pump(t);
    await show(t, find.text('Yesterday'));
    await t.tap(find.text('7:30 AM → 8:45 AM  ·  Qr code').first);
    await t.pump();
    await t.pump(const Duration(seconds: 1));
    expect(find.text('Visit details'), findsOneWidget);
    expect(find.text('Qr code'), findsWidgets);
  });

  testWidgets('tablet 1500x1300 renders without overflow', (t) async {
    await pump(t, size: const Size(1500, 1300));
    await show(t, find.text('Visit history'));
    expect(t.takeException(), isNull);
  });
}
