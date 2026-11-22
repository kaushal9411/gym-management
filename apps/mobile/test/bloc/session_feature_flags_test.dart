// Feature-flag refresh on the session: `SessionCubit.refreshTenant` re-resolves
// the gym and emits ONLY when the tenant (its `featureFlags`) changed; the
// authenticated states compare by tenant value; a burst of "module
// unavailable" 403s (via `ModuleEventBus`) is debounced into one refresh.
import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gym_saas_mobile/bloc/session/session_cubit.dart';
import 'package:gym_saas_mobile/bloc/session/session_state.dart';
import 'package:gym_saas_mobile/core/network/api_exception.dart';
import 'package:gym_saas_mobile/core/network/auth_event_bus.dart';
import 'package:gym_saas_mobile/core/network/dio_client.dart';
import 'package:gym_saas_mobile/core/network/module_event_bus.dart';
import 'package:gym_saas_mobile/core/push/push_notification_service.dart';
import 'package:gym_saas_mobile/core/storage/secure_storage.dart';
import 'package:gym_saas_mobile/models/member_profile.dart';
import 'package:gym_saas_mobile/models/tenant_branding.dart';
import 'package:gym_saas_mobile/models/user_profile.dart';
import 'package:gym_saas_mobile/repositories/auth_repository.dart';
import 'package:gym_saas_mobile/repositories/member_auth_repository.dart';
import 'package:gym_saas_mobile/repositories/public_tenant_repository.dart';
import 'package:mocktail/mocktail.dart';

class _Auth extends Mock implements AuthRepository {}

class _MemberAuth extends Mock implements MemberAuthRepository {}

class _Public extends Mock implements PublicTenantRepository {}

class _Storage extends Mock implements SecureStorage {}

class _Push extends Mock implements PushNotificationService {}

TenantBranding _tenant(List<String> flags, {String name = 'Gym'}) =>
    TenantBranding(
      slug: 'gym',
      name: name,
      status: 'ACTIVE',
      maintenanceMode: false,
      primaryColor: '',
      featureFlags: flags,
    );

const _user = UserProfile(
  id: 'u1',
  tenantId: 't',
  name: 'Owner',
  email: 'o@x.test',
  phone: null,
  status: 'ACTIVE',
  roles: ['OWNER'],
  permissions: [],
);

const _member = MemberProfile(
  id: 'm1',
  memberId: 'MEM-1',
  name: 'Asha',
  email: null,
  status: 'ACTIVE',
);

/// Answers every request with the status/body picked by [route].
class _Adapter implements HttpClientAdapter {
  _Adapter(this.route);

  final (int, Map<String, Object?>) Function(RequestOptions) route;

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
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

void main() {
  setUpAll(() => registerFallbackValue(ActorType.staff));

  group('session state equality', () {
    test('staff states with different featureFlags are NOT equal', () {
      final a = SessionAuthenticatedStaff(_user, _tenant(['attendance']));
      final b = SessionAuthenticatedStaff(_user, _tenant(['attendance', 'x']));
      expect(a, isNot(b));
      expect(a.props, isNot(b.props));
    });

    test('member states with different featureFlags are NOT equal', () {
      expect(
        SessionAuthenticatedMember(_member, _tenant(['attendance'])),
        isNot(SessionAuthenticatedMember(_member, _tenant(const []))),
      );
    });

    test('the same flags (any order) are equal: no spurious re-emit', () {
      expect(
        SessionAuthenticatedStaff(_user, _tenant(['a', 'b'])),
        SessionAuthenticatedStaff(_user, _tenant(['b', 'a'])),
      );
    });
  });

  group('SessionCubit.refreshTenant', () {
    late _Auth auth;
    late _MemberAuth memberAuth;
    late _Public public;
    late _Storage storage;
    late _Push push;
    late ModuleEventBus moduleBus;
    late AuthEventBus authBus;
    late SessionCubit cubit;
    late List<SessionState> emitted;

    setUp(() {
      auth = _Auth();
      memberAuth = _MemberAuth();
      public = _Public();
      storage = _Storage();
      push = _Push();
      moduleBus = ModuleEventBus();
      authBus = AuthEventBus();
      when(() => storage.readTenantSlug()).thenAnswer((_) async => 'gym');
      when(() => storage.readActorType())
          .thenAnswer((_) async => ActorType.staff);
      when(() => storage.clearSession()).thenAnswer((_) async {});
      when(() => push.registerForSession(any())).thenAnswer((_) async {});
      when(() => push.unregister(any())).thenAnswer((_) async {});
      cubit = SessionCubit(
        authRepository: auth,
        memberAuthRepository: memberAuth,
        publicTenantRepository: public,
        storage: storage,
        authEventBus: authBus,
        pushNotificationService: push,
        moduleEventBus: moduleBus,
        moduleRefreshDebounce: const Duration(milliseconds: 30),
      );
      emitted = [];
      cubit.stream.listen(emitted.add);
    });

    tearDown(() => cubit.close());

    Future<void> settle() =>
        Future<void>.delayed(const Duration(milliseconds: 5));

    test('signed out: nothing is resolved or emitted', () async {
      await cubit.refreshTenant();
      verifyNever(() => public.resolve(any()));
      expect(emitted, isEmpty);
    });

    test('emits a NEW state when the flags changed (same user kept)', () async {
      cubit.staffSignedIn(_user, _tenant(['attendance', 'diet_plans']));
      await settle();
      emitted.clear();
      when(() => public.resolve('gym'))
          .thenAnswer((_) async => _tenant(['attendance']));

      await cubit.refreshTenant();
      await settle();

      expect(emitted, hasLength(1));
      final s = emitted.single as SessionAuthenticatedStaff;
      expect(s.user.id, 'u1');
      expect(s.tenant.featureFlags, ['attendance']);
      expect((cubit.state as SessionAuthenticatedStaff).tenant.featureFlags, [
        'attendance',
      ]);
    });

    test('hr switched off / back on is picked up like any other module',
        () async {
      cubit.staffSignedIn(_user, _tenant(['hr', 'attendance']));
      await settle();
      emitted.clear();
      when(() => public.resolve('gym'))
          .thenAnswer((_) async => _tenant(['attendance']));

      await cubit.refreshTenant();
      await settle();

      final off = emitted.single as SessionAuthenticatedStaff;
      expect(off.user.id, 'u1');
      expect(off.tenant.featureFlags, ['attendance']);
      expect(off.tenant.featureFlags.contains('hr'), isFalse);

      emitted.clear();
      when(() => public.resolve('gym'))
          .thenAnswer((_) async => _tenant(['attendance', 'hr']));
      await cubit.refreshTenant();
      await settle();
      expect(
        (emitted.single as SessionAuthenticatedStaff).tenant.featureFlags,
        containsAll(['attendance', 'hr']),
      );
    });

    test('emits nothing when the gym is unchanged', () async {
      cubit.staffSignedIn(_user, _tenant(['attendance']));
      await settle();
      emitted.clear();
      when(() => public.resolve('gym'))
          .thenAnswer((_) async => _tenant(['attendance']));

      await cubit.refreshTenant();
      await settle();

      verify(() => public.resolve('gym')).called(1);
      expect(emitted, isEmpty);
    });

    test('other tenant fields (name) also count as a change', () async {
      cubit.staffSignedIn(_user, _tenant(['attendance']));
      await settle();
      emitted.clear();
      when(() => public.resolve('gym')).thenAnswer(
        (_) async => _tenant(['attendance'], name: 'Renamed Gym'),
      );
      await cubit.refreshTenant();
      await settle();
      expect(emitted, hasLength(1));
    });

    test('a module switched back ON is picked up too', () async {
      cubit.memberSignedIn(_member, _tenant(const []));
      await settle();
      emitted.clear();
      when(() => public.resolve('gym'))
          .thenAnswer((_) async => _tenant(['live_classes']));

      await cubit.refreshTenant();
      await settle();

      final s = emitted.single as SessionAuthenticatedMember;
      expect(s.member.id, 'm1');
      expect(s.tenant.featureFlags, ['live_classes']);
    });

    test('a failed lookup is ignored (flags kept, nothing emitted)', () async {
      cubit.staffSignedIn(_user, _tenant(['attendance']));
      await settle();
      emitted.clear();
      when(() => public.resolve('gym')).thenThrow(ApiException.network());

      await cubit.refreshTenant();
      await settle();

      expect(emitted, isEmpty);
      expect(
        (cubit.state as SessionAuthenticatedStaff).tenant.featureFlags,
        ['attendance'],
      );
    });

    test('minInterval throttles repeated refreshes (app-resume case)',
        () async {
      cubit.staffSignedIn(_user, _tenant(['attendance']));
      await settle();
      when(() => public.resolve('gym'))
          .thenAnswer((_) async => _tenant(['attendance']));

      const gap = Duration(seconds: 60);
      await cubit.refreshTenant(minInterval: gap);
      await cubit.refreshTenant(minInterval: gap);
      await cubit.refreshTenant(minInterval: gap);
      verify(() => public.resolve('gym')).called(1);

      // Without a minInterval (the 403 path) it always goes through.
      await cubit.refreshTenant();
      verify(() => public.resolve('gym')).called(1);
    });

    test('a signed-out session mid-lookup drops the result', () async {
      cubit.staffSignedIn(_user, _tenant(['attendance']));
      await settle();
      emitted.clear();
      when(() => public.resolve('gym')).thenAnswer((_) async {
        authBus.notifyForcedLogout(); // signed out while the lookup runs
        await settle();
        return _tenant(const []);
      });

      await cubit.refreshTenant();
      await settle();

      expect(emitted.whereType<SessionAuthenticatedStaff>(), isEmpty);
      expect(cubit.state, isA<SessionUnauthenticated>());
    });

    group('module-unavailable 403 burst', () {
      test('N notifications -> ONE debounced refresh', () async {
        cubit.staffSignedIn(_user, _tenant(['attendance', 'diet_plans']));
        await settle();
        emitted.clear();
        when(() => public.resolve('gym'))
            .thenAnswer((_) async => _tenant(['attendance']));

        for (var i = 0; i < 6; i++) {
          moduleBus.notifyModuleUnavailable();
          await Future<void>.delayed(const Duration(milliseconds: 5));
        }
        // Still inside the debounce window: nothing yet.
        verifyNever(() => public.resolve(any()));

        await Future<void>.delayed(const Duration(milliseconds: 120));
        verify(() => public.resolve('gym')).called(1);
        expect(emitted, hasLength(1));
        expect(
          (emitted.single as SessionAuthenticatedStaff).tenant.featureFlags,
          ['attendance'],
        );
      });

      test('two bursts far apart -> two refreshes', () async {
        cubit.staffSignedIn(_user, _tenant(['attendance']));
        await settle();
        when(() => public.resolve('gym'))
            .thenAnswer((_) async => _tenant(['attendance']));

        moduleBus.notifyModuleUnavailable();
        await Future<void>.delayed(const Duration(milliseconds: 100));
        moduleBus.notifyModuleUnavailable();
        await Future<void>.delayed(const Duration(milliseconds: 100));

        verify(() => public.resolve('gym')).called(2);
      });
    });
  });

  group('DioClient: module-unavailable 403', () {
    late _Storage storage;
    late ModuleEventBus moduleBus;
    late int signals;

    setUp(() {
      storage = _Storage();
      when(() => storage.readTenantSlug()).thenAnswer((_) async => 'gym');
      when(() => storage.readAccessToken()).thenAnswer((_) async => 'tok');
      moduleBus = ModuleEventBus();
      signals = 0;
      moduleBus.onModuleUnavailable.listen((_) => signals++);
    });

    DioClient clientFor(String message) {
      final client = DioClient(storage, AuthEventBus(), null, moduleBus);
      client.dio.httpClientAdapter = _Adapter(
        (_) => (403, {'success': false, 'message': message}),
      );
      return client;
    }

    test(
        '"This module is currently unavailable." raises the signal and '
        'still reaches the caller untouched', () async {
      final client = clientFor('This module is currently unavailable.');
      DioException? caught;
      try {
        await client.dio.get<dynamic>('/diet-plans');
      } on DioException catch (e) {
        caught = e;
      }
      await Future<void>.delayed(Duration.zero);

      expect(signals, 1);
      final api = ApiException.fromResponseData(
        caught!.response?.data,
        caught.response?.statusCode,
      );
      expect(api.isModuleUnavailable, isTrue);
      expect(api.message, 'This module is currently unavailable.');
    });

    test('any other 403 (permission denied) does not', () async {
      final client = clientFor('You do not have permission');
      await expectLater(
        client.dio.get<dynamic>('/members'),
        throwsA(isA<DioException>()),
      );
      await Future<void>.delayed(Duration.zero);
      expect(signals, 0);
    });

    test('the same message on another status is not it', () {
      expect(
        ApiException.fromResponseData(
          {'message': 'This module is currently unavailable.'},
          500,
        ).isModuleUnavailable,
        isFalse,
      );
    });
  });
}
