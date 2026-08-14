import 'package:dio/dio.dart';

import '../core/network/api_exception.dart';
import '../core/storage/secure_storage.dart';
import '../models/tenant_branding.dart';
import '../models/tenant_summary.dart';

/// Pre-login gym lookup — backs the "Find your gym" screen. Calls the
/// existing `GET /public/tenants/resolve?slug=` (already implemented in
/// `apps/api/src/api/v1/router.ts`, platform-plane, no auth/tenant needed).
class PublicTenantRepository {
  PublicTenantRepository(this._dio, this._storage);

  final Dio _dio;
  final SecureStorage _storage;

  /// [rememberAs], when passed, adds this gym to the on-device "recently
  /// used" list (Find Gym screen's dropdown) under that role — omitted
  /// during silent background re-resolves (session restore) where there's
  /// nothing new to remember.
  Future<TenantBranding> resolve(String slug, {ActorType? rememberAs}) async {
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
      if (rememberAs != null) {
        await _storage.rememberGym(
          RecentGym(
            slug: branding.slug,
            name: branding.name,
            actorType: rememberAs,
          ),
        );
      }
      return branding;
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<List<RecentGym>> recentGyms() => _storage.readRecentGyms();

  Future<void> forgetGym(String slug) => _storage.forgetGym(slug);

  /// `GET /public/tenants` — every gym a login attempt could actually
  /// succeed against (suspended/cancelled/maintenance-mode ones are
  /// already excluded server-side). Backs the Find Gym screen's gym
  /// picker — selecting a row still goes through [resolve] for the full
  /// branding payload Login needs.
  Future<List<TenantSummary>> listActive() async {
    try {
      final response =
          await _dio.get<Map<String, dynamic>>('/public/tenants');
      final items = response.data!['data'] as List;
      return items
          .map((e) => TenantSummary.fromJson(e as Map<String, dynamic>))
          .toList();
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
