import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gym_saas_mobile/core/storage/secure_storage.dart';
import 'package:gym_saas_mobile/models/staff_login_result.dart';
import 'package:gym_saas_mobile/repositories/auth_repository.dart';
import 'package:gym_saas_mobile/repositories/member_auth_repository.dart';
import 'package:gym_saas_mobile/repositories/public_tenant_repository.dart';
import 'package:mocktail/mocktail.dart';

class _Storage extends Mock implements SecureStorage {}

class _Adapter implements HttpClientAdapter {
  _Adapter(this.body);

  final Map<String, Object?> body;
  RequestOptions? last;
  Object? lastData;

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    last = options;
    if (requestStream != null) {
      final chunks = await requestStream.toList();
      lastData = jsonDecode(utf8.decode(chunks.expand((c) => c).toList()));
    }
    return ResponseBody.fromBytes(
      utf8.encode(jsonEncode(body)),
      200,
      headers: {
        Headers.contentTypeHeader: ['application/json; charset=utf-8'],
      },
    );
  }

  @override
  void close({bool force = false}) {}
}

Map<String, Object?> _envelope(Map<String, Object?> data) =>
    {'success': true, 'message': 'ok', 'data': data};

const _userJson = {
  'id': 'u1',
  'tenantId': 't1',
  'name': 'Coach',
  'email': 'coach@gym.com',
  'status': 'ACTIVE',
  'roles': ['TRAINER'],
  'permissions': <String>[],
};

void main() {
  late _Storage storage;

  setUp(() {
    storage = _Storage();
    when(() => storage.saveTenantSlug(any())).thenAnswer((_) async {});
    when(
      () => storage.saveSession(
        actorType: any(named: 'actorType'),
        accessToken: any(named: 'accessToken'),
        refreshToken: any(named: 'refreshToken'),
      ),
    ).thenAnswer((_) async {});
    when(() => storage.saveMemberProfile(any())).thenAnswer((_) async {});
  });

  setUpAll(() => registerFallbackValue(ActorType.staff));

  Dio dioWith(_Adapter a) =>
      Dio(BaseOptions(baseUrl: 'http://x/api'))..httpClientAdapter = a;

  test('staff verify posts to the public endpoint; slug is saved BEFORE tokens',
      () async {
    final adapter = _Adapter(
      _envelope({
        'user': _userJson,
        'accessToken': 'a',
        'accessTokenExpiresAt': 'x',
        'refreshToken': 'r',
        'tenantSlug': 'alpha-fit',
      }),
    );
    final repo = AuthRepository(dioWith(adapter), storage);

    final out = await repo.verifyPublicPhoneOtp(phone: '98', code: '123456');

    expect(adapter.last!.path, '/public/auth/phone-login/verify-otp');
    expect(
      adapter.lastData,
      {'actorType': 'staff', 'phone': '98', 'code': '123456'},
    );
    expect(out.tenantSlug, 'alpha-fit');
    expect(out.result, isA<StaffLoginSuccess>());
    verifyInOrder([
      () => storage.saveTenantSlug('alpha-fit'),
      () => storage.saveSession(
            actorType: ActorType.staff,
            accessToken: 'a',
            refreshToken: 'r',
          ),
    ]);
  });

  test('staff challenge: slug saved, no tokens persisted', () async {
    final adapter = _Adapter(
      _envelope({
        'challenge': 'otp_required',
        'email': 'coach@gym.com',
        'purpose': 'login',
        'expiresInSeconds': 300,
        'tenantSlug': 'alpha-fit',
      }),
    );
    final repo = AuthRepository(dioWith(adapter), storage);

    final out = await repo.verifyPublicPhoneOtp(phone: '98', code: '123456');

    expect(out.result, isA<StaffOtpRequired>());
    expect(out.tenantSlug, 'alpha-fit');
    verify(() => storage.saveTenantSlug('alpha-fit')).called(1);
    verifyNever(
      () => storage.saveSession(
        actorType: any(named: 'actorType'),
        accessToken: any(named: 'accessToken'),
        refreshToken: any(named: 'refreshToken'),
      ),
    );
  });

  test('member verify: slug saved BEFORE tokens, actorType member', () async {
    final adapter = _Adapter(
      _envelope({
        'member': {
          'id': 'm1',
          'memberId': 'MEM-0007',
          'name': 'Mia',
          'status': 'ACTIVE',
        },
        'accessToken': 'a',
        'accessTokenExpiresAt': 'x',
        'refreshToken': 'r',
        'tenantSlug': 'beta-gym',
      }),
    );
    final repo = MemberAuthRepository(dioWith(adapter), storage);

    final out = await repo.verifyPublicPhoneOtp(phone: '98', code: '123456');

    expect(adapter.last!.path, '/public/auth/phone-login/verify-otp');
    expect(adapter.lastData, containsPair('actorType', 'member'));
    expect(out.tenantSlug, 'beta-gym');
    verifyInOrder([
      () => storage.saveTenantSlug('beta-gym'),
      () => storage.saveSession(
            actorType: ActorType.member,
            accessToken: 'a',
            refreshToken: 'r',
          ),
    ]);
  });

  test('public forgot-password / request-otp bodies', () async {
    final adapter = _Adapter(_envelope({}));
    final repo = PublicTenantRepository(dioWith(adapter), storage);

    await repo.forgotPassword(identifier: 'MEM-0007');
    expect(adapter.last!.path, '/public/auth/forgot-password');
    expect(adapter.lastData, {'identifier': 'MEM-0007'});

    await repo.requestPhoneOtp(actorType: ActorType.member, phone: '98');
    expect(adapter.last!.path, '/public/auth/phone-login/request-otp');
    expect(adapter.lastData, {'actorType': 'member', 'phone': '98'});
  });
}
