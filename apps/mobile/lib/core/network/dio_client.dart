import 'dart:async';

import 'package:dio/dio.dart';

import '../config/env.dart';
import '../storage/secure_storage.dart';
import 'auth_event_bus.dart';
import 'api_exception.dart';
import 'maintenance_event_bus.dart';

/// One shared Dio instance for the whole app. Attaches the tenant + auth
/// headers every request needs and transparently retries a single 401 with
/// a refreshed access token — everything downstream (repositories) just
/// awaits a normal response or catches a normal [DioException].
class DioClient {
  DioClient(this._storage, this._authEventBus, [this._maintenanceBus]) {
    dio = Dio(
      BaseOptions(
        baseUrl: Env.apiBaseUrl,
        connectTimeout: const Duration(seconds: 15),
        receiveTimeout: const Duration(seconds: 15),
      ),
    );
    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: _onRequest,
        onError: _onError,
      ),
    );
  }

  late final Dio dio;
  final SecureStorage _storage;
  final AuthEventBus _authEventBus;
  final MaintenanceEventBus? _maintenanceBus;

  Completer<bool>? _refreshInFlight;

  /// Set when the last refresh attempt failed only because the server was in
  /// maintenance (503 MAINTENANCE): the refresh token is still good, so that
  /// failure must never be treated as a dead session.
  bool _refreshBlockedByMaintenance = false;

  Future<void> _onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    final slug = await _storage.readTenantSlug();
    if (slug != null && slug.isNotEmpty) {
      options.headers['X-Tenant-Slug'] = slug;
    }
    final token = await _storage.readAccessToken();
    if (token != null && token.isNotEmpty) {
      options.headers['Authorization'] = 'Bearer $token';
    }
    handler.next(options);
  }

  Future<void> _onError(
    DioException err,
    ErrorInterceptorHandler handler,
  ) async {
    final request = err.requestOptions;

    // Maintenance mode (gym or platform switch): every tenant request answers
    // 503 MAINTENANCE. Surface it to the app-wide overlay and pass the error
    // on untouched — it is neither an auth failure nor a generic server error.
    if (err.response?.statusCode == 503) {
      final mapped = ApiException.fromResponseData(err.response?.data, 503);
      if (mapped.isMaintenance) {
        _maintenanceBus?.notify(const MaintenanceSignal());
        handler.next(err);
        return;
      }
    }

    final isUnauthorized = err.response?.statusCode == 401;
    final hadAuthHeader = request.headers['Authorization'] != null;
    final alreadyRetried = request.extra['retriedAfterRefresh'] == true;

    // Only auto-refresh requests that were actually authenticated calls —
    // login/OTP/forgot-password never carry a bearer token, so a 401 there
    // is a real credential failure, not an expired session.
    // The refresh call itself must never trigger a refresh: it would await
    // its own in-flight completer and hang forever.
    final isRefreshCall = request.path.endsWith('/auth/refresh');
    if (!isUnauthorized || !hadAuthHeader || alreadyRetried || isRefreshCall) {
      handler.next(err);
      return;
    }

    final refreshed = await _refreshSession();
    if (!refreshed) {
      // Tokens stay intact when the refresh was only blocked by maintenance.
      if (!_refreshBlockedByMaintenance) _authEventBus.notifyForcedLogout();
      handler.next(err);
      return;
    }

    try {
      final newToken = await _storage.readAccessToken();
      final retryOptions = request
          .copyWith(extra: {...request.extra, 'retriedAfterRefresh': true});
      if (newToken != null) {
        retryOptions.headers['Authorization'] = 'Bearer $newToken';
      }
      final response = await dio.fetch<dynamic>(retryOptions);
      handler.resolve(response);
    } on DioException catch (retryError) {
      handler.next(retryError);
    }
  }

  /// De-duplicated — if several requests 401 at once, only one refresh call
  /// is made and the rest await its result.
  Future<bool> _refreshSession() async {
    if (_refreshInFlight != null) return _refreshInFlight!.future;

    final completer = Completer<bool>();
    _refreshInFlight = completer;
    _refreshBlockedByMaintenance = false;
    try {
      final actorType = await _storage.readActorType();
      final refreshToken = await _storage.readRefreshToken();
      if (actorType == null || refreshToken == null) {
        completer.complete(false);
        return completer.future;
      }

      final path = actorType == ActorType.staff
          ? '/auth/refresh'
          : '/member/auth/refresh';
      final slug = await _storage.readTenantSlug();
      final response = await dio.post<Map<String, dynamic>>(
        path,
        data: {'refreshToken': refreshToken},
        options: Options(headers: {if (slug != null) 'X-Tenant-Slug': slug}),
      );
      final data = response.data?['data'] as Map<String, dynamic>?;
      final newAccessToken = data?['accessToken'] as String?;
      final newRefreshToken = data?['refreshToken'] as String?;
      if (newAccessToken == null) {
        completer.complete(false);
        return completer.future;
      }
      await _storage.saveAccessToken(newAccessToken);
      if (newRefreshToken != null) {
        await _storage.saveSession(
          actorType: actorType,
          accessToken: newAccessToken,
          refreshToken: newRefreshToken,
        );
      }
      completer.complete(true);
    } catch (e) {
      if (e is DioException && e.response?.statusCode == 503) {
        _refreshBlockedByMaintenance = ApiException.fromResponseData(
          e.response?.data,
          503,
        ).isMaintenance;
      }
      completer.complete(false);
    } finally {
      _refreshInFlight = null;
    }
    return completer.future;
  }
}
