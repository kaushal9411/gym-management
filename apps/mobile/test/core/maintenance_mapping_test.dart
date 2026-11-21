import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gym_saas_mobile/core/network/api_exception.dart';
import 'package:gym_saas_mobile/core/network/auth_event_bus.dart';
import 'package:gym_saas_mobile/core/network/dio_client.dart';
import 'package:gym_saas_mobile/core/network/maintenance_event_bus.dart';
import 'package:gym_saas_mobile/core/storage/secure_storage.dart';
import 'package:gym_saas_mobile/models/tenant_branding.dart';
import 'package:mocktail/mocktail.dart';

class _Storage extends Mock implements SecureStorage {}

Map<String, Object?> _maintenanceBody([String message = 'Back at 6pm']) => {
      'success': false,
      'message': message,
      'errors': [
        {'code': 'MAINTENANCE', 'message': message},
      ],
    };

/// Answers every request with the status/body picked by [route].
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
    paths.add(options.path);
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
  group('ApiException.isMaintenance', () {
    test('503 + MAINTENANCE code is the typed flag, with the admin text', () {
      final e =
          ApiException.fromResponseData(_maintenanceBody('Gym closed'), 503);
      expect(e.isMaintenance, isTrue);
      expect(e.message, 'Gym closed');
      expect(e.code, 'MAINTENANCE');
    });

    test('a generic 503, or MAINTENANCE on another status, is not it', () {
      expect(
        ApiException.fromResponseData({'message': 'Down'}, 503).isMaintenance,
        isFalse,
      );
      expect(
        ApiException.fromResponseData(_maintenanceBody(), 500).isMaintenance,
        isFalse,
      );
      expect(ApiException.network().isMaintenance, isFalse);
    });
  });

  group('TenantBranding.maintenanceMessage', () {
    Map<String, dynamic> json(Object? msg) => {
          'slug': 'g',
          'name': 'Gym',
          'maintenanceMode': true,
          'maintenanceMessage': msg,
        };

    test('parses the custom text; blank/absent is null (default copy)', () {
      expect(
        TenantBranding.fromJson(json('  Back soon ')).maintenanceMessage,
        'Back soon',
      );
      expect(TenantBranding.fromJson(json(null)).maintenanceMessage, isNull);
      expect(TenantBranding.fromJson(json('   ')).maintenanceMessage, isNull);
      expect(TenantBranding.fromJson(json('x')).maintenanceMode, isTrue);
    });
  });

  group('DioClient maintenance handling', () {
    late _Storage storage;
    late AuthEventBus authBus;
    late MaintenanceEventBus maintBus;
    late int forcedLogouts;
    late List<MaintenanceSignal> signals;

    setUp(() {
      storage = _Storage();
      when(() => storage.readTenantSlug()).thenAnswer((_) async => 'gym');
      when(() => storage.readAccessToken()).thenAnswer((_) async => 'tok');
      when(() => storage.readRefreshToken()).thenAnswer((_) async => 'ref');
      when(() => storage.readActorType())
          .thenAnswer((_) async => ActorType.staff);
      authBus = AuthEventBus();
      maintBus = MaintenanceEventBus();
      forcedLogouts = 0;
      signals = [];
      authBus.onForcedLogout.listen((_) => forcedLogouts++);
      maintBus.onMaintenance.listen(signals.add);
    });

    test('503 MAINTENANCE raises the signal and the exception keeps the flag',
        () async {
      final client = DioClient(storage, authBus, maintBus);
      client.dio.httpClientAdapter =
          _Adapter((_) => (503, _maintenanceBody('TEST')));

      DioException? caught;
      try {
        await client.dio.get<dynamic>('/members');
      } on DioException catch (e) {
        caught = e;
      }
      await Future<void>.delayed(Duration.zero);

      expect(caught, isNotNull);
      final api = ApiException.fromResponseData(
        caught!.response?.data,
        caught.response?.statusCode,
      );
      expect(api.isMaintenance, isTrue);
      expect(signals, hasLength(1));
      expect(forcedLogouts, 0);
      verifyNever(() => storage.saveAccessToken(any()));
    });

    test('a generic 503 does not raise the maintenance signal', () async {
      final client = DioClient(storage, authBus, maintBus);
      client.dio.httpClientAdapter =
          _Adapter((_) => (503, {'success': false, 'message': 'Down'}));
      await expectLater(
        client.dio.get<dynamic>('/members'),
        throwsA(isA<DioException>()),
      );
      await Future<void>.delayed(Duration.zero);
      expect(signals, isEmpty);
    });

    test('401 whose refresh is blocked by maintenance does NOT log out',
        () async {
      final client = DioClient(storage, authBus, maintBus);
      final adapter = _Adapter((o) {
        if (o.path == '/auth/refresh') return (503, _maintenanceBody());
        return (401, {'success': false, 'message': 'Expired'});
      });
      client.dio.httpClientAdapter = adapter;

      await expectLater(
        client.dio.get<dynamic>('/members'),
        throwsA(isA<DioException>()),
      );
      await Future<void>.delayed(Duration.zero);

      expect(adapter.paths, contains('/auth/refresh'));
      expect(forcedLogouts, 0);
      expect(signals, isNotEmpty);
    });

    test('401 whose refresh is simply rejected still logs out', () async {
      final client = DioClient(storage, authBus, maintBus);
      client.dio.httpClientAdapter = _Adapter(
        (_) => (401, {'success': false, 'message': 'Invalid refresh token'}),
      );
      await expectLater(
        client.dio.get<dynamic>('/members'),
        throwsA(isA<DioException>()),
      );
      await Future<void>.delayed(Duration.zero);
      expect(forcedLogouts, 1);
    });
  });
}
