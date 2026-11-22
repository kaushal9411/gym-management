import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gym_saas_mobile/core/storage/secure_storage.dart';
import 'package:gym_saas_mobile/models/phone_login_result.dart';
import 'package:gym_saas_mobile/models/staff_login_result.dart';
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

  setUpAll(() => registerFallbackValue(ActorType.staff));

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

  Dio dioWith(_Adapter a) =>
      Dio(BaseOptions(baseUrl: 'http://x/api'))..httpClientAdapter = a;

  const tokens = {
    'accessToken': 'a',
    'accessTokenExpiresAt': 'x',
    'refreshToken': 'r',
  };

  const memberJson = {
    'id': 'm1',
    'memberId': 'MEM-0007',
    'name': 'Mia',
    'status': 'ACTIVE',
  };

  test('staff verify: no actorType sent, slug saved BEFORE staff tokens',
      () async {
    final adapter = _Adapter(
      _envelope({
        'user': _userJson,
        ...tokens,
        'tenantSlug': 'alpha-fit',
        'actorType': 'staff',
      }),
    );
    final repo = PublicTenantRepository(dioWith(adapter), storage);

    final out = await repo.verifyPhoneOtp(phone: '98', code: '123456');

    expect(adapter.last!.path, '/public/auth/phone-login/verify-otp');
    expect(adapter.lastData, {'phone': '98', 'code': '123456'});
    expect(out, isA<PhoneLoginStaff>());
    expect(out.tenantSlug, 'alpha-fit');
    expect((out as PhoneLoginStaff).result, isA<StaffLoginSuccess>());
    verifyInOrder([
      () => storage.saveTenantSlug('alpha-fit'),
      () => storage.saveSession(
            actorType: ActorType.staff,
            accessToken: 'a',
            refreshToken: 'r',
          ),
    ]);
    verifyNever(() => storage.saveMemberProfile(any()));
  });

  test('staff challenge: slug saved, no tokens persisted', () async {
    final adapter = _Adapter(
      _envelope({
        'challenge': 'otp_required',
        'email': 'coach@gym.com',
        'purpose': 'login',
        'expiresInSeconds': 300,
        'tenantSlug': 'alpha-fit',
        'actorType': 'staff',
      }),
    );
    final repo = PublicTenantRepository(dioWith(adapter), storage);

    final out = await repo.verifyPhoneOtp(phone: '98', code: '123456');

    expect(out, isA<PhoneLoginStaff>());
    expect((out as PhoneLoginStaff).result, isA<StaffOtpRequired>());
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

  test('member verify: actorType member, slug saved BEFORE member tokens',
      () async {
    final adapter = _Adapter(
      _envelope({
        'member': memberJson,
        ...tokens,
        'tenantSlug': 'beta-gym',
        'actorType': 'member',
      }),
    );
    final repo = PublicTenantRepository(dioWith(adapter), storage);

    final out = await repo.verifyPhoneOtp(phone: '98', code: '123456');

    expect(out, isA<PhoneLoginMember>());
    expect(out.tenantSlug, 'beta-gym');
    expect((out as PhoneLoginMember).result.member.memberId, 'MEM-0007');
    verifyInOrder([
      () => storage.saveTenantSlug('beta-gym'),
      () => storage.saveSession(
            actorType: ActorType.member,
            accessToken: 'a',
            refreshToken: 'r',
          ),
      () => storage.saveMemberProfile(any()),
    ]);
  });

  test('an older API without actorType still resolves a member by its payload',
      () async {
    final adapter = _Adapter(
      _envelope({
        'member': memberJson,
        ...tokens,
        'tenantSlug': 'beta-gym',
      }),
    );
    final repo = PublicTenantRepository(dioWith(adapter), storage);

    final out = await repo.verifyPhoneOtp(phone: '98', code: '123456');

    expect(out, isA<PhoneLoginMember>());
  });

  test('public forgot-password / request-otp bodies', () async {
    final adapter = _Adapter(_envelope({}));
    final repo = PublicTenantRepository(dioWith(adapter), storage);

    await repo.forgotPassword(identifier: 'MEM-0007');
    expect(adapter.last!.path, '/public/auth/forgot-password');
    expect(adapter.lastData, {'identifier': 'MEM-0007'});

    await repo.requestPhoneOtp(phone: '98');
    expect(adapter.last!.path, '/public/auth/phone-login/request-otp');
    expect(adapter.lastData, {'phone': '98'});
  });
}
