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

  /// Cold-start restore — see [SecureStorage.saveMemberProfile] for why this
  /// reads a cache instead of calling an endpoint.
  Future<MemberProfile?> restoreCachedProfile() async {
    final json = await _storage.readMemberProfile();
    return json == null ? null : MemberProfile.fromJson(json);
  }

  Future<void> forgotPassword({required String memberId}) async {
    try {
      await _dio.post<void>(
        '/member/auth/forgot-password',
        data: {'memberId': memberId},
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
