import 'package:bloc_test/bloc_test.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:gym_saas_mobile/bloc/maintenance/maintenance_cubit.dart';
import 'package:gym_saas_mobile/bloc/platform/platform_config_cubit.dart';
import 'package:gym_saas_mobile/bloc/session/session_cubit.dart';
import 'package:gym_saas_mobile/bloc/session/session_state.dart';
import 'package:gym_saas_mobile/core/network/api_exception.dart';
import 'package:gym_saas_mobile/core/network/maintenance_event_bus.dart';
import 'package:gym_saas_mobile/core/storage/secure_storage.dart';
import 'package:gym_saas_mobile/features/maintenance/presentation/maintenance_host.dart';
import 'package:gym_saas_mobile/models/tenant_branding.dart';
import 'package:gym_saas_mobile/repositories/public_tenant_repository.dart';
import 'package:mocktail/mocktail.dart';

class _Repo extends Mock implements PublicTenantRepository {}

class _Storage extends Mock implements SecureStorage {}

class _Session extends MockCubit<SessionState> implements SessionCubit {}

class _Platform extends MockCubit<PlatformConfigState>
    implements PlatformConfigCubit {}

TenantBranding _branding({required bool maintenance, String? message}) =>
    TenantBranding(
      slug: 'kaushal-fitness-club',
      name: 'Kaushal Fitness Club',
      status: 'ACTIVE',
      maintenanceMode: maintenance,
      primaryColor: '',
      maintenanceMessage: message,
    );

void main() {
  late _Repo repo;
  late _Storage storage;
  late _Session session;
  late _Platform platform;
  String? supportEmail;
  late MaintenanceEventBus bus;
  late MaintenanceCubit cubit;

  setUpAll(() => GoogleFonts.config.allowRuntimeFetching = false);

  setUp(() {
    repo = _Repo();
    storage = _Storage();
    session = _Session();
    platform = _Platform();
    supportEmail = null;
    when(() => platform.state).thenAnswer(
      (_) => PlatformConfigState('FitCloud', supportEmail: supportEmail),
    );
    when(() => session.state).thenReturn(const SessionUnauthenticated());
    when(() => storage.readTenantSlug())
        .thenAnswer((_) async => 'kaushal-fitness-club');
  });

  tearDown(() => cubit.close());

  Future<void> pumpHost(WidgetTester tester) async {
    // Built inside the test body so its streams live in the fake-async zone
    // (created in setUp they would only tick on the real event loop).
    bus = MaintenanceEventBus();
    cubit = MaintenanceCubit(bus: bus, repository: repo, storage: storage);
    tester.view.physicalSize = const Size(1080, 2400);
    tester.view.devicePixelRatio = 2.75;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(
      MultiBlocProvider(
        providers: [
          BlocProvider<MaintenanceCubit>.value(value: cubit),
          BlocProvider<SessionCubit>.value(value: session),
          BlocProvider<PlatformConfigCubit>.value(value: platform),
        ],
        child: const MaterialApp(
          home: MaintenanceHost(child: Scaffold(body: Text('the app'))),
        ),
      ),
    );
  }

  /// Bloc streams deliver one microtask hop per layer (bus -> cubit -> widget),
  /// so give the tree a few frames to catch up.
  Future<void> flush(WidgetTester tester, [int ms = 800]) async {
    await tester.pump();
    await tester.pump();
    await tester.pump(Duration(milliseconds: ms));
  }

  /// What `PublicTenantRepository.resolve` does on a maintenance gym.
  void raise({String? message}) => bus.notify(
        MaintenanceSignal(
          slug: 'kaushal-fitness-club',
          gymName: 'Kaushal Fitness Club',
          message: message,
        ),
      );

  testWidgets('shows nothing until maintenance is signalled', (tester) async {
    await pumpHost(tester);
    expect(find.text('the app'), findsOneWidget);
    expect(find.text("We're servicing the gym"), findsNothing);
  });

  testWidgets('renders the gym name and the admin message in a callout',
      (tester) async {
    await pumpHost(tester);
    raise(message: 'Back at 6pm - new squat racks!');
    await flush(tester, 800);

    expect(find.text("We're servicing the gym"), findsOneWidget);
    expect(find.text('Kaushal Fitness Club'), findsOneWidget);
    expect(find.text('Back at 6pm - new squat racks!'), findsOneWidget);
    expect(find.text('Paused'), findsOneWidget);
    expect(find.text('Upgrading'), findsOneWidget);
    expect(find.text('Back online'), findsOneWidget); // the third step
    expect(find.text('Check now'), findsOneWidget);
  });

  testWidgets('no custom message: default copy only, no callout',
      (tester) async {
    await pumpHost(tester);
    raise();
    await flush(tester);
    expect(find.textContaining('NOTE FROM'), findsNothing);
    expect(find.textContaining('Everything is paused'), findsOneWidget);
  });

  testWidgets('support email: shows a Need help line only when set',
      (tester) async {
    supportEmail = 'help@fitcloud.test';
    await pumpHost(tester);
    raise();
    await flush(tester);
    expect(
      find.textContaining('Need help?', findRichText: true),
      findsOneWidget,
    );
    expect(
      find.textContaining('help@fitcloud.test', findRichText: true),
      findsOneWidget,
    );
  });

  testWidgets('no support email configured: no Need help line', (tester) async {
    await pumpHost(tester);
    raise();
    await flush(tester);
    expect(find.textContaining('Need help?', findRichText: true), findsNothing);
  });

  testWidgets('Check now: resolve says false -> Back online, then the app',
      (tester) async {
    when(() => repo.resolve('kaushal-fitness-club'))
        .thenAnswer((_) async => _branding(maintenance: false));
    await pumpHost(tester);
    raise(message: 'Hold tight');
    await flush(tester);

    await tester.tap(find.text('Check now'));
    await flush(tester, 400);

    verify(() => repo.resolve('kaushal-fitness-club')).called(1);
    expect(cubit.state.backOnline, isTrue);
    expect(find.text('Hold tight'), findsNothing);
    expect(find.text('All set — taking you right back.'), findsOneWidget);

    // After the celebration beat the overlay lifts; the app was never touched.
    await flush(tester, 3000);
    expect(cubit.state.active, isFalse);
    expect(find.text('Kaushal Fitness Club'), findsNothing);
    expect(find.text('the app'), findsOneWidget);
  });

  testWidgets('still in maintenance: message refreshes, overlay stays',
      (tester) async {
    when(() => repo.resolve('kaushal-fitness-club')).thenAnswer(
      (_) async => _branding(maintenance: true, message: 'Now until 8pm'),
    );
    await pumpHost(tester);
    raise(message: 'Until 6pm');
    await flush(tester);

    await tester.tap(find.text('Check now'));
    await flush(tester, 400);

    expect(cubit.state.active, isTrue);
    expect(find.text('Now until 8pm'), findsOneWidget);
  });

  testWidgets('offline check shows a gentle note and keeps the overlay',
      (tester) async {
    when(() => repo.resolve(any())).thenThrow(ApiException.network());
    await pumpHost(tester);
    raise();
    await flush(tester);

    await tester.tap(find.text('Check now'));
    await flush(tester, 400);

    expect(find.text("Couldn't reach the server"), findsOneWidget);
    expect(find.text("We'll keep trying."), findsOneWidget);
    expect(cubit.state.active, isTrue);
  });

  testWidgets('auto-check fires after the interval (30 s by default)',
      (tester) async {
    when(() => repo.resolve(any()))
        .thenAnswer((_) async => _branding(maintenance: true));
    await pumpHost(tester);
    raise();
    await flush(tester, 29000);
    verifyNever(() => repo.resolve(any()));
    await flush(tester, 2000);
    verify(() => repo.resolve('kaushal-fitness-club')).called(1);
  });

  group('pre-login (no gym known): polls the platform config', () {
    setUp(() {
      when(() => storage.readTenantSlug()).thenAnswer((_) async => null);
    });

    testWidgets('a bare 503 fetches the platform message; resolve is unused',
        (tester) async {
      when(() => repo.getPlatformInfo()).thenAnswer(
        (_) async => const PlatformInfo(
          'FitCloud',
          null,
          maintenanceEnabled: true,
          maintenanceMessage: 'Platform upgrade',
        ),
      );
      await pumpHost(tester);
      bus.notify(const MaintenanceSignal()); // bare Dio 503
      await flush(tester);

      expect(find.text('Platform upgrade'), findsOneWidget);
      verifyNever(() => repo.resolve(any()));
    });

    testWidgets('Check now: platform switch off -> Back online -> the app',
        (tester) async {
      when(() => repo.getPlatformInfo())
          .thenAnswer((_) async => const PlatformInfo('FitCloud', null));
      await pumpHost(tester);
      bus.notify(const MaintenanceSignal(platform: true, message: 'Wait'));
      await flush(tester);
      expect(find.text('Wait'), findsOneWidget);

      await tester.tap(find.text('Check now'));
      await flush(tester, 400);
      expect(cubit.state.backOnline, isTrue);
      await flush(tester, 3000);
      expect(cubit.state.active, isFalse);
      expect(find.text('the app'), findsOneWidget);
    });

    testWidgets('an unreachable platform config is "offline", not "back"',
        (tester) async {
      when(() => repo.getPlatformInfo()).thenAnswer(
        (_) async => const PlatformInfo('FitCloud', null, reachable: false),
      );
      await pumpHost(tester);
      bus.notify(const MaintenanceSignal(platform: true));
      await flush(tester);
      await tester.tap(find.text('Check now'));
      await flush(tester, 400);

      expect(cubit.state.active, isTrue);
      expect(find.text("Couldn't reach the server"), findsOneWidget);
    });
  });
}
