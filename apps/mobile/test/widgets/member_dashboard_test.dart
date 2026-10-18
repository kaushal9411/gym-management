import 'package:bloc_test/bloc_test.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:get_it/get_it.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:gym_saas_mobile/bloc/session/session_cubit.dart';
import 'package:gym_saas_mobile/bloc/session/session_state.dart';
import 'package:gym_saas_mobile/core/network/api_exception.dart';
import 'package:gym_saas_mobile/features/member/presentation/member_dashboard_screen.dart';
import 'package:gym_saas_mobile/models/body_measurement.dart';
import 'package:gym_saas_mobile/models/gym_info.dart';
import 'package:gym_saas_mobile/models/gym_member.dart';
import 'package:gym_saas_mobile/models/member_invoice.dart';
import 'package:gym_saas_mobile/models/member_overview.dart';
import 'package:gym_saas_mobile/models/member_portal_profile.dart';
import 'package:gym_saas_mobile/models/member_profile.dart';
import 'package:gym_saas_mobile/models/paginated_result.dart';
import 'package:gym_saas_mobile/models/tenant_branding.dart';
import 'package:gym_saas_mobile/repositories/member_notification_repository.dart';
import 'package:gym_saas_mobile/repositories/member_portal_repository.dart';
import 'package:mocktail/mocktail.dart';

import '../models/member_overview_test.dart' show fullFixture, realFixture;

class _Repo extends Mock implements MemberPortalRepository {}

class _Notifs extends Mock implements MemberNotificationRepository {}

class _Session extends MockCubit<SessionState> implements SessionCubit {}

const _tenant = TenantBranding(
  slug: 't',
  name: 'T',
  status: 'ACTIVE',
  maintenanceMode: false,
  primaryColor: '',
);

MemberPortalProfile _profile({String? qr}) => MemberPortalProfile(
      id: 'm1',
      memberId: 'MEM-0001',
      name: 'Asha Rao',
      email: 'asha@x.test',
      phone: null,
      status: 'ACTIVE',
      branch: const MemberBranchSummary(id: 'b', name: 'Main'),
      currentMembership: CurrentMembershipSummary(
        planId: 'p',
        planName: 'Gold',
        startDate: DateTime.now().subtract(const Duration(days: 30)),
        endDate: DateTime.now().add(const Duration(days: 60)),
        status: 'ACTIVE',
        autoRenew: false,
      ),
      joiningDate: DateTime(2026, 1, 5),
      qrCodeImageUrl: qr,
    );

PaginatedResult<T> _page<T>(List<T> items) => PaginatedResult<T>(
      items: items,
      total: items.length,
      page: 1,
      limit: 20,
      totalPages: 1,
    );

MemberInvoice _invoice(String id, String status) => MemberInvoice(
      id: id,
      invoiceNumber: 'INV-$id',
      member: const InvoiceMemberSummary(
        id: 'm1',
        memberId: 'MEM-0001',
        name: 'Asha Rao',
      ),
      invoiceDate: DateTime(2026, 10, 1),
      dueDate: DateTime(2026, 10, 15),
      subtotal: 1000,
      taxAmount: 0,
      totalAmount: 1000,
      status: status,
    );

void main() {
  setUpAll(() {
    GoogleFonts.config.allowRuntimeFetching = false;
  });

  late _Repo repo;

  setUp(() {
    repo = _Repo();
    final g = GetIt.instance;
    if (g.isRegistered<MemberPortalRepository>()) {
      g.unregister<MemberPortalRepository>();
    }
    if (g.isRegistered<MemberNotificationRepository>()) {
      g.unregister<MemberNotificationRepository>();
    }
    g.registerSingleton<MemberPortalRepository>(repo);
    final notifs = _Notifs();
    when(() => notifs.unreadCount()).thenAnswer((_) async => 2);
    g.registerSingleton<MemberNotificationRepository>(notifs);

    when(() => repo.overview())
        .thenAnswer((_) async => MemberOverview.fromJson(fullFixture()));
    when(() => repo.me()).thenAnswer((_) async => _profile(qr: 'https://x/q'));
    when(() => repo.attendance(limit: any(named: 'limit')))
        .thenAnswer((_) async => _page([]));
    when(() => repo.workout()).thenAnswer((_) async => null);
    when(() => repo.invoices(limit: any(named: 'limit'))).thenAnswer(
      (_) async => _page([_invoice('1', 'PAID'), _invoice('2', 'PENDING')]),
    );
    when(() => repo.measurements()).thenAnswer((_) async => []);
    when(() => repo.gymInfo()).thenAnswer(
      (_) async => GymInfo(
        name: 'Kaushal Fitness',
        logoUrl: null,
        address: null,
        phone: '+911234567890',
        email: 'hello@gym.test',
        website: 'https://gym.test',
        businessHours: null,
        social: const {},
        branch: null,
      ),
    );
  });

  Future<List<int>> pump(
    WidgetTester t, {
    Size size = const Size(360, 740),
  }) async {
    final taps = <int>[];
    t.view.physicalSize = size * 2;
    t.view.devicePixelRatio = 2;
    addTearDown(t.view.reset);
    final session = _Session();
    when(() => session.state).thenReturn(
      const SessionAuthenticatedMember(
        MemberProfile(
          id: 'm1',
          memberId: 'MEM-0001',
          name: 'Asha Rao',
          email: 'asha@x.test',
          status: 'ACTIVE',
        ),
        _tenant,
      ),
    );
    final router = GoRouter(
      routes: [
        GoRoute(
          path: '/',
          builder: (_, __) => Scaffold(
            body: MemberDashboardScreen(onQuickAction: taps.add),
          ),
        ),
        GoRoute(
          path: '/member/profile',
          builder: (_, __) => const Text('PROFILE PAGE'),
        ),
        GoRoute(
          path: '/member/attendance',
          builder: (_, __) => const Text('ATT'),
        ),
      ],
    );
    await t.pumpWidget(
      BlocProvider<SessionCubit>.value(
        value: session,
        child: MaterialApp.router(routerConfig: router),
      ),
    );
    await t.pump();
    await t.pump(const Duration(seconds: 3));
    return taps;
  }

  Future<void> show(WidgetTester t, Finder f) async {
    for (var i = 0; i < 40 && f.evaluate().isEmpty; i++) {
      await t.drag(find.byType(Scrollable).first, const Offset(0, -300));
      await t.pump();
    }
    await t.ensureVisible(f.first);
    await t.pump();
  }

  testWidgets('phone 360: hero, tiles and every card', (t) async {
    await pump(t);
    expect(t.takeException(), isNull);
    expect(find.text('Asha'), findsOneWidget);
    for (final label in [
      'Renew',
      'Book class',
      'My QR',
      'Membership',
      'Visits this month',
      'Current streak',
      'Workout progress',
      'Diet today',
      'Outstanding',
      'Attendance',
      'Upcoming classes',
      'Workout',
      'Body snapshot',
      'Recent invoices',
      'Kaushal Fitness',
      'My data',
    ]) {
      await show(t, find.text(label));
      expect(find.text(label), findsWidgets, reason: label);
    }
    expect(t.takeException(), isNull);
  });

  testWidgets('tapping the hero avatar opens My Profile', (t) async {
    await pump(t);
    await t.tap(find.byKey(const ValueKey('hero-avatar')));
    await t.pump();
    await t.pump(const Duration(seconds: 1));
    expect(find.text('PROFILE PAGE'), findsOneWidget);
  });

  testWidgets('hero actions: Book class jumps to the Classes tab', (t) async {
    final taps = await pump(t);
    await t.tap(find.text('Book class'));
    await t.pump();
    expect(taps, [3]);
  });

  testWidgets('My QR is hidden without a QR image', (t) async {
    when(() => repo.me()).thenAnswer((_) async => _profile());
    await pump(t);
    expect(find.text('My QR'), findsNothing);
  });

  testWidgets('an unpaid invoice shows the Pay strip', (t) async {
    await pump(t);
    await show(t, find.byKey(const ValueKey('dash-pay')));
    expect(find.byKey(const ValueKey('dash-pay')), findsOneWidget);
    expect(find.textContaining('INV-2 · '), findsOneWidget);
  });

  testWidgets('real-shaped overview (no workout/diet/classes) still renders',
      (t) async {
    when(() => repo.overview())
        .thenAnswer((_) async => MemberOverview.fromJson(realFixture()));
    await pump(t);
    expect(t.takeException(), isNull);
    await show(t, find.text('Total visits'));
    await show(t, find.text('No workout plan'));
    await show(t, find.text('Nothing booked'));
    expect(t.takeException(), isNull);
  });

  testWidgets('expired membership shows Expired and the solid Renew',
      (t) async {
    final j = fullFixture();
    (j['membership'] as Map<String, dynamic>)
      ..['expired'] = true
      ..['daysLeft'] = -4;
    when(() => repo.overview())
        .thenAnswer((_) async => MemberOverview.fromJson(j));
    await pump(t);
    expect(find.text('Expired'), findsWidgets);
    expect(t.takeException(), isNull);
  });

  testWidgets('body snapshot shows the latest record with its change',
      (t) async {
    BodyMeasurement m(DateTime d, double w) => BodyMeasurement(
          id: '$w',
          memberId: 'm1',
          recordedAt: d,
          weightKg: w,
          heightCm: null,
          bodyFatPercent: null,
          chestCm: null,
          waistCm: null,
          hipsCm: null,
          bicepsCm: null,
          thighsCm: null,
          notes: null,
          recordedBy: null,
        );
    when(() => repo.measurements()).thenAnswer(
      (_) async =>
          [m(DateTime(2026, 9, 1), 72), m(DateTime(2026, 10, 1), 70.5)],
    );
    await pump(t);
    await show(t, find.text('70.5kg'));
    expect(find.text('-1.5kg'), findsOneWidget);
  });

  testWidgets('an optional call failing only degrades its card', (t) async {
    when(() => repo.invoices(limit: any(named: 'limit')))
        .thenAnswer((_) async => throw ApiException.network());
    when(() => repo.gymInfo())
        .thenAnswer((_) async => throw ApiException.network());
    await pump(t);
    await show(t, find.text('No invoices yet'));
    expect(t.takeException(), isNull);
  });

  testWidgets('an overview failure shows retry', (t) async {
    when(() => repo.overview())
        .thenAnswer((_) async => throw ApiException.network());
    await pump(t);
    expect(find.text('Try again'), findsOneWidget);
  });

  testWidgets('tablet 1500x1300 renders without overflow', (t) async {
    await pump(t, size: const Size(1500, 1300));
    await show(t, find.text('My data'));
    expect(t.takeException(), isNull);
  });
}
