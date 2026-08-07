import 'package:dio/dio.dart';

import '../core/env.dart';
import '../storage/secure_storage.dart';

/// Mirrors features/auth/services/api-client.ts on tenant-web: attaches
/// X-Tenant-Slug + Bearer on every request, and does a single refresh-and
/// -retry on 401 rather than looping. A bare Dio (no interceptors) is used
/// for the refresh call itself so it can't recurse into this interceptor.
class DioClient {
  final Dio dio;
  final SecureStorage _storage;
  final Dio _refreshDio;
  Future<bool>? _refreshInFlight;

  DioClient(this._storage)
      : dio = Dio(
          BaseOptions(
            baseUrl: Env.apiBaseUrl,
            connectTimeout: const Duration(seconds: 15),
            receiveTimeout: const Duration(seconds: 15),
          ),
        ),
        _refreshDio = Dio(BaseOptions(baseUrl: Env.apiBaseUrl)) {
    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          final slug = await _storage.tenantSlug;
          if (slug != null && slug.isNotEmpty) {
            options.headers['X-Tenant-Slug'] = slug;
          }
          final token = await _storage.accessToken;
          if (token != null && token.isNotEmpty) {
            options.headers['Authorization'] = 'Bearer $token';
          }
          handler.next(options);
        },
        onError: (error, handler) async {
          final isAuthRoute = error.requestOptions.path.contains('/auth/');
          if (error.response?.statusCode == 401 && !isAuthRoute) {
            final refreshed = await _refreshOnce();
            if (refreshed) {
              try {
                final retried = await dio.fetch<dynamic>(error.requestOptions);
                return handler.resolve(retried);
              } on DioException catch (retryError) {
                return handler.next(retryError);
              }
            }
          }
          handler.next(error);
        },
      ),
    );
  }

  Future<bool> _refreshOnce() {
    return _refreshInFlight ??= _doRefresh().whenComplete(() {
      _refreshInFlight = null;
    });
  }

  Future<bool> _doRefresh() async {
    final refreshToken = await _storage.refreshToken;
    final slug = await _storage.tenantSlug;
    if (refreshToken == null || refreshToken.isEmpty) return false;
    try {
      final response = await _refreshDio.post<Map<String, dynamic>>(
        '/auth/refresh',
        data: {'refreshToken': refreshToken},
        options: Options(
          headers: {
            if (slug != null) 'X-Tenant-Slug': slug,
          },
        ),
      );
      final data = response.data!['data'] as Map<String, dynamic>;
      await _storage.saveTokens(
        accessToken: data['accessToken'] as String,
        refreshToken: data['refreshToken'] as String,
      );
      return true;
    } on DioException {
      await _storage.clearSession();
      return false;
    }
  }
}
