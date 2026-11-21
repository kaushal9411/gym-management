import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:bloc_test/bloc_test.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:get_it/get_it.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:gym_saas_mobile/bloc/maintenance/maintenance_cubit.dart';
import 'package:gym_saas_mobile/bloc/platform/platform_config_cubit.dart';
import 'package:gym_saas_mobile/bloc/session/session_cubit.dart';
import 'package:gym_saas_mobile/bloc/session/session_state.dart';
import 'package:gym_saas_mobile/core/network/auth_event_bus.dart';
import 'package:gym_saas_mobile/core/network/dio_client.dart';
import 'package:gym_saas_mobile/core/network/maintenance_event_bus.dart';
import 'package:gym_saas_mobile/core/storage/secure_storage.dart';
import 'package:gym_saas_mobile/features/auth/presentation/login_screen.dart';
import 'package:gym_saas_mobile/features/maintenance/presentation/maintenance_host.dart';
import 'package:gym_saas_mobile/repositories/public_tenant_repository.dart';
import 'package:mocktail/mocktail.dart';

/// End-to-end through the REAL DioClient interceptor + repository + cubit +
/// host (only the HTTP adapter and secure storage are fake).

class _Storage extends Mock implements SecureStorage {}

class _Session extends MockCubit<SessionState> implements SessionCubit {}

class _Adapter implements HttpClientAdapter {
  _Adapter(this.route);

  final (int, Map<String, Object?>) Function(RequestOptions) route;
  final paths = <String>[];

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    paths.add('${options.method} ${options.path}');
    final (status, body) = route(options);
    return ResponseBody.fromBytes(
      utf8.encode(jsonEncode(body)),
      status,
      headers: {
        Headers.contentTypeHeader: ['application/json; charset=utf-8'],
      },
    );
  }

  @override
  void close({bool force = false}) {}
}

Map<String, Object?> _platformConfig({required bool maintenance}) => {
      'success': true,
      'message': 'ok',
      'data': {
        'appName': 'FitCloud',
        'supportEmail': 'help@fitcloud.test',
        'maintenance': {
          'enabled': maintenance,
          'message': maintenance ? 'Platform upgrade' : null,
        },
      },
    };

Map<String, Object?> _maintenance503(String text) => {
      'success': false,
      'message': text,
      'errors': [
        {'code': 'MAINTENANCE', 'message': text},
      ],
    };

void main() {
  late _Storage storage;
  late _Session session;
  late MaintenanceEventBus bus;
  late MaintenanceCubit maintenance;
  late PublicTenantRepository repo;
  late _Adapter adapter;
  late PlatformConfigCubit platformCubit;
  var platformOn = true;

  setUpAll(() => GoogleFonts.config.allowRuntimeFetching = false);

  setUp(() {
    platformOn = true;
    storage = _Storage();
    session = _Session();
    when(() => session.state).thenReturn(const SessionUnauthenticated());
    when(() => storage.readTenantSlug()).thenAnswer((_) async => null);
    when(() => storage.readAccessToken()).thenAnswer((_) async => null);
    when(() => storage.saveTenantSlug(any())).thenAnswer((_) async {});
  });

  tearDown(() async {
    await maintenance.close();
    await GetIt.instance.reset();
  });

  /// Built in the test body so every stream lives in the fake-async zone.
  Future<void> pumpApp(WidgetTester tester, Widget home) async {
    tester.view.physicalSize = const Size(1080, 2400);
    tester.view.devicePixelRatio = 2.75;
    addTearDown(tester.view.reset);

    bus = MaintenanceEventBus();
    adapter = _Adapter((o) {
      if (o.path == '/public/platform-config') {
        return (200, _platformConfig(maintenance: platformOn));
      }
      // Every other (tenant-scoped / auth) call is blocked while it is on.
      return (503, _maintenance503('SERVICE-DOWN-ERR'));
    });
    final client = DioClient(storage, AuthEventBus(), bus);
    client.dio.httpClientAdapter = adapter;
    repo = PublicTenantRepository(client.dio, storage, bus);
    maintenance = MaintenanceCubit(
      bus: bus,
      repository: repo,
      storage: storage,
    );
    platformCubit = PlatformConfigCubit(repo);
    GetIt.instance.registerSingleton<PublicTenantRepository>(repo);

    await tester.pumpWidget(
      MultiBlocProvider(
        providers: [
          BlocProvider<MaintenanceCubit>.value(value: maintenance),
          BlocProvider<SessionCubit>.value(value: session),
          BlocProvider<PlatformConfigCubit>.value(
            value: platformCubit,
          ),
        ],
        child: MaterialApp(home: MaintenanceHost(child: home)),
      ),
    );
  }

  Future<void> flush(WidgetTester tester, [int ms = 800]) async {
    await tester.pump();
    await tester.pump();
    await tester.pump(Duration(milliseconds: ms));
  }

  testWidgets(
      'login 503 MAINTENANCE -> Maintenance screen, NO error on the login form',
      (tester) async {
    await pumpApp(tester, const LoginScreen());
    await tester.pump(const Duration(milliseconds: 1600));

    await tester.enterText(find.byType(TextField).first, 'coach@gym.com');
    await tester.enterText(find.byType(TextField).last, 'Passw0rd!');
    await tester.tap(find.text('Sign in'));
    await flush(tester, 1200);

    expect(adapter.paths, contains('POST /public/auth/discover-gyms'));
    // The dedicated screen is up, with the platform's message ...
    expect(maintenance.state.active, isTrue);
    expect(find.text("We're servicing the gym"), findsOneWidget);
    expect(find.text('Platform upgrade'), findsOneWidget);
    // ... and the login form shows the 503 text nowhere (no inline/banner).
    expect(find.text('SERVICE-DOWN-ERR'), findsNothing);
  });

  testWidgets('platform-config enabled at startup -> Maintenance screen',
      (tester) async {
    await pumpApp(tester, const Scaffold(body: Text('login form')));
    expect(maintenance.state.active, isFalse);

    // main.dart: platformConfigCubit.load() before the first frame / on resume.
    unawaited(platformCubit.load());
    await flush(tester);

    expect(maintenance.state.active, isTrue);
    expect(find.text("We're servicing the gym"), findsOneWidget);
    expect(find.text('Platform upgrade'), findsOneWidget);
    expect(
      find.textContaining('help@fitcloud.test', findRichText: true),
      findsOneWidget,
    );
  });

  testWidgets('platform-config disabled at startup -> no overlay',
      (tester) async {
    platformOn = false;
    await pumpApp(tester, const Scaffold(body: Text('login form')));
    unawaited(platformCubit.load());
    await flush(tester);

    expect(maintenance.state.active, isFalse);
    expect(find.text("We're servicing the gym"), findsNothing);
  });

  testWidgets('pre-login poll uses platform-config; off -> back to the app',
      (tester) async {
    await pumpApp(tester, const Scaffold(body: Text('login form')));
    unawaited(platformCubit.load());
    await flush(tester);

    platformOn = false;
    await tester.tap(find.text('Check now'));
    await flush(tester, 400);
    expect(maintenance.state.backOnline, isTrue);
    await flush(tester, 3000);
    expect(maintenance.state.active, isFalse);
    expect(find.text('login form'), findsOneWidget);
  });
}
