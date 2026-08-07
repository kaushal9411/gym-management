import 'package:dio/dio.dart';

import '../../../core/errors/app_exception.dart';
import '../../../models/tenant.dart';
import '../../../storage/secure_storage.dart';
import 'login_result.dart';

class AuthRepository {
  final Dio _dio;
  final SecureStorage _storage;

  AuthRepository(this._dio, this._storage);

  Future<Tenant> resolveTenant(String slug) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        '/public/tenants/resolve',
        queryParameters: {'slug': slug},
        options: Options(headers: {'X-Tenant-Slug': slug}),
      );
      final tenant =
          Tenant.fromJson(response.data!['data'] as Map<String, dynamic>);
      await _storage.saveTenantSlug(slug);
      return tenant;
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<LoginResult> login({
    required String tenantSlug,
    required String email,
    required String password,
  }) async {
    try {
      await _storage.saveTenantSlug(tenantSlug);
      final response = await _dio.post<Map<String, dynamic>>(
        '/auth/login',
        data: {'email': email, 'password': password},
        options: Options(headers: {'X-Tenant-Slug': tenantSlug}),
      );
      final result =
          loginResultFromJson(response.data!['data'] as Map<String, dynamic>);
      if (result is LoginSuccess) {
        await _storage.saveSession(
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
          tenantSlug: tenantSlug,
        );
      }
      return result;
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<LoginResult> verifyOtp({
    required String email,
    required String code,
    required String purpose,
    required String tenantSlug,
  }) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        '/auth/verify-otp',
        data: {'email': email, 'code': code, 'purpose': purpose},
      );
      final result =
          loginResultFromJson(response.data!['data'] as Map<String, dynamic>);
      if (result is LoginSuccess) {
        await _storage.saveSession(
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
          tenantSlug: tenantSlug,
        );
      }
      return result;
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<void> logout() async {
    try {
      await _dio.post<void>('/auth/logout');
    } on DioException {
      // best-effort — still clear the local session below
    }
    await _storage.clearSession();
  }

  AppException _mapError(DioException e) {
    if (e.type == DioExceptionType.connectionError ||
        e.type == DioExceptionType.connectionTimeout) {
      return AppException.network();
    }
    return AppException.fromDioData(e.response?.data, e.response?.statusCode);
  }
}
