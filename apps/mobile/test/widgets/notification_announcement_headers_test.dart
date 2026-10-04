import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:gym_saas_mobile/features/announcements/presentation/widgets/announcement_insights_header.dart';
import 'package:gym_saas_mobile/features/notifications/presentation/widgets/notification_insights_header.dart';
import 'package:gym_saas_mobile/models/announcement_stats.dart';
import 'package:gym_saas_mobile/models/notification_stats.dart';
import 'package:gym_saas_mobile/repositories/announcement_repository.dart';
import 'package:gym_saas_mobile/repositories/tenant_notification_repository.dart';
import 'package:mocktail/mocktail.dart';

class _MockNotifRepo extends Mock implements TenantNotificationRepository {}

class _MockAnnRepo extends Mock implements AnnouncementRepository {}

void main() {
  setUpAll(() => GoogleFonts.config.allowRuntimeFetching = false);

  Future<void> pump<C extends StateStreamableSource<Object?>>(
    WidgetTester t,
    C cubit,
    Widget header,
  ) async {
    t.view.physicalSize = const Size(360 * 3, 800 * 3);
    t.view.devicePixelRatio = 3;
    addTearDown(t.view.reset);
    await t.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: BlocProvider<C>.value(
            value: cubit,
            child: SingleChildScrollView(child: header),
          ),
        ),
      ),
    );
  }

  testWidgets('notification header renders at 360px without overflow',
      (t) async {
    final repo = _MockNotifRepo();
    when(
      () => repo.stats(
        dateFrom: any(named: 'dateFrom'),
        dateTo: any(named: 'dateTo'),
      ),
    ).thenAnswer(
      (_) async => NotificationStats.fromJson({
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
          {'category': 'PAYMENT', 'count': 7, 'unread': 3, 'previousCount': 2},
        ],
        'hourly': [
          {'hour': 9, 'count': 8},
        ],
      }),
    );
    final cubit = NotificationStatsCubit(repo.stats);
    addTearDown(cubit.close);
    await pump(t, cubit, const NotificationInsightsHeader());
    await cubit.load();
    await t.pump();
    await t.pump(const Duration(seconds: 2));
    expect(find.text('Total'), findsOneWidget);
    expect(find.text('Unread'), findsOneWidget);
    expect(find.text('Read rate'), findsOneWidget);
    expect(find.text('Volume over time'), findsOneWidget);
    expect(find.text('Payments'), findsOneWidget);
    expect(find.textContaining('09:00'), findsOneWidget);
    expect(t.takeException(), isNull);
  });

  testWidgets('announcement header renders at 360px without overflow',
      (t) async {
    final repo = _MockAnnRepo();
    when(
      () => repo.stats(
        dateFrom: any(named: 'dateFrom'),
        dateTo: any(named: 'dateTo'),
      ),
    ).thenAnswer(
      (_) async => AnnouncementStats.fromJson({
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
          {'date': '2026-10-02', 'published': 1, 'previousPublished': 0},
        ],
        'byStatus': [
          {'status': 'DRAFT', 'count': 1},
          {'status': 'PUBLISHED', 'count': 3},
        ],
        'byAudience': [
          {'audience': 'ALL', 'count': 2, 'previousCount': 0},
        ],
        'byBranch': <Object>[],
        'upcoming': [
          {
            'id': 'a1',
            'title': 'Sale starts',
            'audience': 'MEMBERS',
            'publishAt': '2026-10-05T10:00:00.000Z',
          },
        ],
        'expiring': <Object>[],
        'recent': [
          {
            'id': 'a3',
            'title': 'Gym closed Sunday',
            'audience': 'ALL',
            'publishedAt': '2026-10-01T08:00:00.000Z',
            'delivered': null,
            'read': null,
          },
        ],
      }),
    );
    final cubit = AnnouncementStatsCubit(repo.stats);
    addTearDown(cubit.close);
    await pump(t, cubit, const AnnouncementInsightsHeader());
    await cubit.load();
    await t.pump();
    await t.pump(const Duration(seconds: 2));
    expect(find.text('Published'), findsWidgets);
    expect(find.text('Expiring soon'), findsWidgets);
    expect(find.text('Published over time'), findsOneWidget);
    expect(find.text('Sale starts'), findsOneWidget);
    expect(find.textContaining('not tracked per announcement'), findsOneWidget);
    expect(t.takeException(), isNull);
  });

  testWidgets('forbidden state renders nothing', (t) async {
    final cubit = NotificationStatsCubit(
      ({required String dateFrom, required String dateTo}) =>
          throw UnimplementedError(),
    )..hide();
    addTearDown(cubit.close);
    await pump(t, cubit, const NotificationInsightsHeader());
    expect(find.text('Insights'), findsNothing);
  });
}
