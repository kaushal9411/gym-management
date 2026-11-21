import 'package:dio/dio.dart';

import '../core/network/api_exception.dart';
import '../core/storage/secure_storage.dart';
import '../models/member_auth_success.dart';
import '../models/member_profile.dart';

/// Member auth plane — `/member/auth/*`. Login is by `memberId` (e.g.
/// `MEM-0003`), not email; there is no OTP/2FA challenge on this plane at
/// all (see `member-auth.types.ts` — `MemberAuthSuccess` is never a union).
class MemberAuthRepository {
  MemberAuthRepository(this._dio, this._storage);

  final Dio _dio;
  final SecureStorage _storage;

  Future<MemberAuthSuccess> login({
    required String memberId,
    required String password,
  }) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        '/member/auth/login',
        data: {'memberId': memberId, 'password': password},
      );
      final result = MemberAuthSuccess.fromJson(
        response.data!['data'] as Map<String, dynamic>,
      );
      await _storage.saveSession(
        actorType: ActorType.member,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      );
      await _storage.saveMemberProfile(result.member.toJson());
      return result;
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  // ── Phone-number login (OTP, delivered by email for now) ───────────────

  /// `POST /public/auth/phone-login/verify-otp` (`actorType: member`) — no
  /// gym is known yet; the server returns the member's `tenantSlug`
  /// alongside the usual [MemberAuthSuccess]. The slug is saved BEFORE the
  /// tokens so the Dio interceptor already sends `X-Tenant-Slug`. The code is
  /// requested (and re-requested) via [PublicTenantRepository.requestPhoneOtp].
  Future<({MemberAuthSuccess result, String tenantSlug})> verifyPublicPhoneOtp({
    required String phone,
    required String code,
  }) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        '/public/auth/phone-login/verify-otp',
        data: {'actorType': 'member', 'phone': phone, 'code': code},
      );
      final data = response.data!['data'] as Map<String, dynamic>;
      final tenantSlug = data['tenantSlug'] as String;
      final result = MemberAuthSuccess.fromJson(data);
      await _storage.saveTenantSlug(tenantSlug);
      await _storage.saveSession(
        actorType: ActorType.member,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      );
      await _storage.saveMemberProfile(result.member.toJson());
      return (result: result, tenantSlug: tenantSlug);
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  /// Cold-start restore — see [SecureStorage.saveMemberProfile] for why this
  /// reads a cache instead of calling an endpoint.
  Future<MemberProfile?> restoreCachedProfile() async {
    final json = await _storage.readMemberProfile();
    return json == null ? null : MemberProfile.fromJson(json);
  }

  /// Consumes the token from the emailed reset link and sets a new
  /// password — the counterpart to the public forgot-password call. No deep-link handling
  /// exists in this app yet, so the caller is a token the user pastes in
  /// manually rather than one resolved from a tapped link.
  Future<void> resetPassword({
    required String token,
    required String password,
  }) async {
    try {
      await _dio.post<void>(
        '/member/auth/reset-password',
        data: {'token': token, 'password': password},
      );
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<void> logout() async {
    try {
      final refreshToken = await _storage.readRefreshToken();
      await _dio.post<void>(
        '/member/auth/logout',
        data: {'refreshToken': refreshToken},
      );
    } on DioException {
      // best-effort — session is cleared locally either way
    } finally {
      await _storage.clearSession();
    }
  }

  ApiException _mapError(DioException e) {
    if (e.type == DioExceptionType.connectionError ||
        e.type == DioExceptionType.connectionTimeout) {
      return ApiException.network();
    }
    return ApiException.fromResponseData(
      e.response?.data,
      e.response?.statusCode,
    );
  }
}
