import 'package:dio/dio.dart';

import '../core/network/api_exception.dart';
import '../core/storage/secure_storage.dart';
import '../models/tenant_branding.dart';

/// Pre-login gym lookup — backs the "Find your gym" screen. Calls the
/// existing `GET /public/tenants/resolve?slug=` (already implemented in
/// `apps/api/src/api/v1/router.ts`, platform-plane, no auth/tenant needed).
class PublicTenantRepository {
  PublicTenantRepository(this._dio, this._storage);

  final Dio _dio;
  final SecureStorage _storage;

  Future<TenantBranding> resolve(String slug) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        '/public/tenants/resolve',
        queryParameters: {'slug': slug},
        options: Options(headers: {'X-Tenant-Slug': slug}),
      );
      final branding = TenantBranding.fromJson(
        response.data!['data'] as Map<String, dynamic>,
      );
      await _storage.saveTenantSlug(branding.slug);
      return branding;
    } on DioException catch (e) {
      throw _mapError(e);
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
