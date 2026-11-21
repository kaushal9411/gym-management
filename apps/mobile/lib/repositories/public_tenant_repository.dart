import 'package:dio/dio.dart';

import '../core/network/api_exception.dart';
import '../core/network/maintenance_event_bus.dart';
import '../core/storage/secure_storage.dart';
import '../models/tenant_branding.dart';
import '../models/tenant_summary.dart';

/// `GET /public/platform-config` result: the platform name plus the optional
/// support email.
class PlatformInfo {
  const PlatformInfo(
    this.appName,
    this.supportEmail, {
    this.maintenanceEnabled = false,
    this.maintenanceMessage,
    this.reachable = true,
  });

  final String appName;
  final String? supportEmail;

  /// The platform-wide maintenance switch (`maintenance.enabled`).
  final bool maintenanceEnabled;
  final String? maintenanceMessage;

  /// False when the call itself failed (offline, 5xx) and the other fields
  /// are just the fallback defaults — a re-check must not read that as
  /// "maintenance is over".
  final bool reachable;
}

/// Pre-login public (no auth, no tenant) calls: gym branding lookup
/// (`GET /public/tenants/resolve?slug=`), multi-gym discovery after a
/// password check, and the gym-less forgot-password / phone-OTP-request
/// endpoints.
class PublicTenantRepository {
  PublicTenantRepository(this._dio, this._storage, [this._maintenanceBus]);

  final Dio _dio;
  final SecureStorage _storage;
  final MaintenanceEventBus? _maintenanceBus;

  /// Public resolve — still answers 200 during maintenance. When the result
  /// says `maintenanceMode` (gym or platform switch) it is also reported to
  /// the app-wide maintenance overlay, so every caller (login, session
  /// restore, gym picker) gets the maintenance screen without handling it.
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
      if (branding.maintenanceMode) {
        _maintenanceBus?.notify(
          MaintenanceSignal(
            message: branding.maintenanceMessage,
            gymName: branding.name,
            slug: branding.slug,
          ),
        );
      }
      return branding;
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  /// `POST /public/auth/discover-gyms` — which gym(s) these credentials
  /// belong to, so [LoginScreen] never has to ask for a gym up front. Only
  /// gyms where the password verifies come back (never empty — no match is a
  /// 401 `INVALID_CREDENTIALS`, surfaced as an [ApiException] like any login
  /// failure). The real tenant-scoped login still follows against the gym
  /// that's picked.
  Future<List<TenantSummary>> discoverGyms({
    required ActorType actorType,
    required String identifier,
    required String password,
  }) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        '/public/auth/discover-gyms',
        data: {
          'actorType': actorType.name,
          'identifier': identifier,
          'password': password,
        },
      );
      final items =
          (response.data!['data'] as Map<String, dynamic>)['gyms'] as List;
      return items
          .map((e) => TenantSummary.fromJson(e as Map<String, dynamic>))
          .toList();
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  /// `POST /public/auth/forgot-password` — one identifier (an email is
  /// staff, anything else a Member ID); the server emails a reset link for
  /// every gym that identifier exists in and always answers a generic 200, so
  /// no gym is ever asked for or resolved.
  Future<void> forgotPassword({required String identifier}) async {
    try {
      await _dio.post<void>(
        '/public/auth/forgot-password',
        data: {'identifier': identifier},
      );
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  /// `POST /public/auth/phone-login/request-otp` — also used for "resend"
  /// (there is no public resend route). Generic 200 either way, so it never
  /// reveals whether the number has an account.
  Future<void> requestPhoneOtp({
    required ActorType actorType,
    required String phone,
  }) async {
    try {
      await _dio.post<void>(
        '/public/auth/phone-login/request-otp',
        data: {'actorType': actorType.name, 'phone': phone},
      );
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  /// `GET /public/platform-config` — the super-admin-configured platform/app
  /// name, no auth required. Unlike every other call in this class, this
  /// never throws: it's a cosmetic value (app title, menu copy, notification
  /// channel name), never worth blocking startup or surfacing an error for,
  /// so any failure just falls back to the static default.
  Future<String> getPlatformConfig() async =>
      (await getPlatformInfo()).appName;

  /// Same call as [getPlatformConfig] (also never throws), plus the optional
  /// `supportEmail` the super admin set under Company Information.
  Future<PlatformInfo> getPlatformInfo() async {
    try {
      final response =
          await _dio.get<Map<String, dynamic>>('/public/platform-config');
      final data = response.data?['data'] as Map<String, dynamic>?;
      final appName = data?['appName'] as String?;
      final email = (data?['supportEmail'] as String?)?.trim();
      // `maintenance: { enabled, message }` — the platform-wide switch, so the
      // app can show the Maintenance screen before any login. Optional: an
      // older API simply omits it (= off).
      final maintenance = data?['maintenance'];
      final enabled =
          maintenance is Map<String, dynamic> && maintenance['enabled'] == true;
      final rawMessage = maintenance is Map<String, dynamic>
          ? maintenance['message']
          : null;
      final message = rawMessage is String && rawMessage.trim().isNotEmpty
          ? rawMessage.trim()
          : null;
      if (enabled) {
        _maintenanceBus?.notify(
          MaintenanceSignal(message: message, platform: true),
        );
      }
      return PlatformInfo(
        (appName != null && appName.trim().isNotEmpty) ? appName : 'FitCloud',
        (email == null || email.isEmpty) ? null : email,
        maintenanceEnabled: enabled,
        maintenanceMessage: message,
      );
    } catch (_) {
      return const PlatformInfo('FitCloud', null, reachable: false);
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
