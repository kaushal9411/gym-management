import 'dart:async';

import 'package:bloc_test/bloc_test.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:gym_saas_mobile/bloc/maintenance/maintenance_cubit.dart';
import 'package:gym_saas_mobile/bloc/platform/platform_config_cubit.dart';
import 'package:gym_saas_mobile/bloc/session/session_cubit.dart';
import 'package:gym_saas_mobile/bloc/session/session_state.dart';
import 'package:gym_saas_mobile/core/network/maintenance_event_bus.dart';
import 'package:gym_saas_mobile/core/storage/secure_storage.dart';
import 'package:gym_saas_mobile/features/maintenance/presentation/maintenance_host.dart';
import 'package:gym_saas_mobile/models/tenant_branding.dart';
import 'package:gym_saas_mobile/repositories/public_tenant_repository.dart';
import 'package:mocktail/mocktail.dart';

/// Android Back while the maintenance overlay is up. Mirrors production: a
/// `MaterialApp.router` (GoRouter) whose `builder` is the [MaintenanceHost], so
/// the covered app has a real, poppable route underneath the overlay.

class _Repo extends Mock implements PublicTenantRepository {}

class _Storage extends Mock implements SecureStorage {}

class _Session extends MockCubit<SessionState> implements SessionCubit {}

class _Platform extends MockCubit<PlatformConfigState>
    implements PlatformConfigCubit {}

void main() {
  late _Repo repo;
  late _Storage storage;
  late _Session session;
  late _Platform platform;
  late MaintenanceEventBus bus;
  late MaintenanceCubit cubit;
  late GoRouter router;
  var systemPops = 0;

  setUpAll(() => GoogleFonts.config.allowRuntimeFetching = false);

  setUp(() {
    systemPops = 0;
    repo = _Repo();
    storage = _Storage();
    session = _Session();
    platform = _Platform();
    when(() => platform.state)
        .thenReturn(const PlatformConfigState('FitCloud'));
    when(() => session.state).thenReturn(const SessionUnauthenticated());
    when(() => storage.readTenantSlug())
        .thenAnswer((_) async => 'kaushal-fitness-club');
    // Stand-in for the Android embedder: record SystemNavigator.pop().
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(SystemChannels.platform, (call) async {
      if (call.method == 'SystemNavigator.pop') systemPops++;
      return null;
    });
  });

  tearDown(() {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(SystemChannels.platform, null);
    cubit.close();
  });

  Future<void> pumpApp(WidgetTester tester, {bool pushDetail = true}) async {
    bus = MaintenanceEventBus();
    cubit = MaintenanceCubit(bus: bus, repository: repo, storage: storage);
    tester.view.physicalSize = const Size(1080, 2400);
    tester.view.devicePixelRatio = 2.75;
    addTearDown(tester.view.reset);
    router = GoRouter(
      routes: [
        GoRoute(
          path: '/',
          builder: (_, __) => const Scaffold(body: Text('home page')),
          routes: [
            GoRoute(
              path: 'detail',
              builder: (_, __) => const Scaffold(body: Text('detail page')),
            ),
          ],
        ),
      ],
    );
    await tester.pumpWidget(
      MultiBlocProvider(
        providers: [
          BlocProvider<MaintenanceCubit>.value(value: cubit),
          BlocProvider<SessionCubit>.value(value: session),
          BlocProvider<PlatformConfigCubit>.value(value: platform),
        ],
        child: MaterialApp.router(
          routerConfig: router,
          builder: (context, child) =>
              MaintenanceHost(child: child ?? const SizedBox.shrink()),
        ),
      ),
    );
    if (pushDetail) {
      unawaited(router.push('/detail'));
      await tester.pumpAndSettle();
      expect(find.text('detail page'), findsOneWidget);
    }
  }

  Future<void> flush(WidgetTester tester, [int ms = 800]) async {
    await tester.pump();
    await tester.pump();
    await tester.pump(Duration(milliseconds: ms));
  }

  void raise() => bus.notify(
        const MaintenanceSignal(
          slug: 'kaushal-fitness-club',
          gymName: 'Kaushal Fitness Club',
        ),
      );

  testWidgets('no overlay: Back pops the route as usual, no minimise',
      (tester) async {
    await pumpApp(tester);

    await tester.binding.handlePopRoute();
    await tester.pumpAndSettle();

    expect(find.text('detail page'), findsNothing);
    expect(find.text('home page'), findsOneWidget);
    expect(systemPops, 0);
  });

  testWidgets('overlay active: Back minimises and leaves the hidden route alone',
      (tester) async {
    await pumpApp(tester);
    raise();
    await flush(tester);
    expect(cubit.state.active, isTrue);
    expect(find.text("We're servicing the gym"), findsOneWidget);

    await tester.binding.handlePopRoute();
    await tester.pump(const Duration(milliseconds: 600));

    expect(systemPops, 1);
    // The covered app is untouched: still on the pushed route, overlay intact.
    expect(find.text('detail page'), findsOneWidget);
    expect(find.text('home page'), findsNothing);
    expect(find.text("We're servicing the gym"), findsOneWidget);
    expect(cubit.state.active, isTrue);
  });

  testWidgets('overlay active on the root route (nothing to pop): minimises',
      (tester) async {
    await pumpApp(tester, pushDetail: false);
    raise();
    await flush(tester);

    await tester.binding.handlePopRoute();
    await tester.pump();

    expect(systemPops, 1);
    expect(find.text('home page', skipOffstage: false), findsOneWidget);
    expect(find.text("We're servicing the gym"), findsOneWidget);
  });

  testWidgets('overlay widgets still work; once lifted Back pops normally',
      (tester) async {
    when(() => repo.resolve('kaushal-fitness-club')).thenAnswer(
      (_) async => const TenantBranding(
        slug: 'kaushal-fitness-club',
        name: 'Kaushal Fitness Club',
        status: 'ACTIVE',
        maintenanceMode: false,
        primaryColor: '',
      ),
    );
    await pumpApp(tester);
    raise();
    await flush(tester);

    // Back during the overlay minimises ...
    await tester.binding.handlePopRoute();
    await tester.pump();
    expect(systemPops, 1);

    // ... "Check now" is still tappable and runs the celebration -> lift.
    await tester.tap(find.text('Check now'));
    await flush(tester, 400);
    expect(cubit.state.backOnline, isTrue);
    // Still the overlay (celebration beat): Back still must not pop the route.
    await tester.binding.handlePopRoute();
    await tester.pump();
    expect(systemPops, 2);
    expect(find.text('detail page'), findsOneWidget);

    await flush(tester, 3000);
    expect(cubit.state.active, isFalse);
    expect(find.text("We're servicing the gym"), findsNothing);
    expect(find.text('detail page'), findsOneWidget);

    // Overlay gone: normal Back behaviour is restored (pops, no minimise).
    await tester.binding.handlePopRoute();
    await tester.pumpAndSettle();
    expect(find.text('detail page'), findsNothing);
    expect(find.text('home page'), findsOneWidget);
    expect(systemPops, 2);
  });
}
