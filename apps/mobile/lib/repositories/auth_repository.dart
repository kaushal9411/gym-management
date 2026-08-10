import 'package:dio/dio.dart';

import '../core/network/api_exception.dart';
import '../core/storage/secure_storage.dart';
import '../models/mfa_setup.dart';
import '../models/staff_login_result.dart';
import '../models/user_profile.dart';

/// Staff auth plane — `/auth/*` (Owner/Manager/Trainer/Receptionist).
/// Tenant is resolved per-request via the `X-Tenant-Slug` header (see
/// `tenant.middleware.ts`'s `extractSlug`), read from [SecureStorage] by
/// [DioClient]'s request interceptor — repositories never pass it manually.
class AuthRepository {
  AuthRepository(this._dio, this._storage);

  final Dio _dio;
  final SecureStorage _storage;

  Future<StaffLoginResult> login({
    required String email,
    required String password,
  }) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        '/auth/login',
        data: {'email': email, 'password': password},
      );
      final result = StaffLoginResult.fromJson(
        response.data!['data'] as Map<String, dynamic>,
      );
      if (result is StaffLoginSuccess) await _persist(result);
      return result;
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<StaffLoginSuccess> verifyOtp({
    required String email,
    required String code,
    required String purpose,
  }) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        '/auth/verify-otp',
        data: {'email': email, 'code': code, 'purpose': purpose},
      );
      final result = StaffLoginResult.fromJson(
        response.data!['data'] as Map<String, dynamic>,
      ) as StaffLoginSuccess;
      await _persist(result);
      return result;
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<void> resendOtp({
    required String email,
    required String purpose,
  }) async {
    try {
      await _dio.post<void>(
        '/auth/resend-otp',
        data: {'email': email, 'purpose': purpose},
      );
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<MfaSetupChallenge> mfaSetupBegin({required String setupToken}) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        '/auth/mfa/setup/begin',
        data: {'setupToken': setupToken},
      );
      return MfaSetupChallenge.fromJson(
        response.data!['data'] as Map<String, dynamic>,
      );
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<MfaSetupConfirmResult> mfaSetupConfirm({
    required String setupToken,
    required String code,
  }) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        '/auth/mfa/setup/confirm',
        data: {'setupToken': setupToken, 'code': code},
      );
      final result = MfaSetupConfirmResult.fromJson(
        response.data!['data'] as Map<String, dynamic>,
      );
      await _persist(result.login);
      return result;
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  /// Used on cold start to restore a session from a stored access token —
  /// also implicitly proves the token (and the stored tenant slug it was
  /// issued under) is still valid.
  Future<UserProfile> me() async {
    try {
      final response = await _dio.get<Map<String, dynamic>>('/auth/me');
      return UserProfile.fromJson(
        response.data!['data'] as Map<String, dynamic>,
      );
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<void> forgotPassword({required String email}) async {
    try {
      await _dio.post<void>('/auth/forgot-password', data: {'email': email});
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<void> logout() async {
    try {
      final refreshToken = await _storage.readRefreshToken();
      await _dio
          .post<void>('/auth/logout', data: {'refreshToken': refreshToken});
    } on DioException {
      // best-effort — session is cleared locally either way
    } finally {
      await _storage.clearSession();
    }
  }

  Future<void> _persist(StaffLoginSuccess result) => _storage.saveSession(
        actorType: ActorType.staff,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      );

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
