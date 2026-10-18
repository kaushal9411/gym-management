import 'package:dio/dio.dart';

import '../core/network/api_exception.dart';
import '../models/mfa_setup.dart';
import '../models/staff_profile.dart';

/// Staff plane's own-account profile — `GET/PATCH /profile`. Distinct from
/// `AuthRepository.me()` (`/auth/me`, roles+permissions for the header
/// avatar/greeting); this is the fuller self-service record (avatar,
/// branch access, emergency contact, notification prefs). Email is
/// deliberately never sent here — the backend requires `users:manage` to
/// change it, so it isn't part of self-service profile editing.
///
/// One `PATCH /profile` call backs every method below, but each sends only
/// the keys its own screen owns — the backend's Prisma `update` treats an
/// **absent** key as "leave untouched" but an explicit `null` as "clear it"
/// (`profile.service.ts`), so a screen that only edits e.g. emergency
/// contact must never also send `phone`/`avatarUrl`, or it would wipe them.
class ProfileRepository {
  ProfileRepository(this._dio);

  final Dio _dio;

  Future<StaffProfile> getProfile() async {
    try {
      final response = await _dio.get<Map<String, dynamic>>('/profile');
      return StaffProfile.fromJson(
        response.data!['data'] as Map<String, dynamic>,
      );
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<StaffProfile> updateBasicInfo({
    required String name,
    String? phone,
  }) =>
      _patch({'name': name, 'phone': phone});

  /// `avatarUrl` is a data: URL (base64) or `null` to clear the photo.
  Future<StaffProfile> updateAvatar(String? avatarUrl) =>
      _patch({'avatarUrl': avatarUrl});

  Future<StaffProfile> updateEmergencyContact({
    String? name,
    String? phone,
    String? relation,
  }) =>
      _patch({
        'emergencyContactName': name,
        'emergencyContactPhone': phone,
        'emergencyContactRelation': relation,
      });

  Future<StaffProfile> updateNotificationPreferences(
    Map<String, bool> preferences,
  ) =>
      _patch({'notificationPreferences': preferences});

  /// `POST /profile/two-factor/setup` — a fresh secret + QR for an
  /// authenticator app (same shape the login-time setup returns).
  Future<MfaSetupChallenge> beginTwoFactorSetup() async {
    try {
      final response =
          await _dio.post<Map<String, dynamic>>('/profile/two-factor/setup');
      return MfaSetupChallenge.fromJson(
        response.data!['data'] as Map<String, dynamic>,
      );
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  /// `POST /profile/two-factor/setup/confirm` — turns 2FA on; returns the
  /// one-time backup codes.
  Future<List<String>> confirmTwoFactorSetup(String code) =>
      _codes('/profile/two-factor/setup/confirm', {'code': code});

  /// `POST /profile/two-factor/backup-codes/regenerate` — needs a current
  /// authenticator code; invalidates the old set.
  Future<List<String>> regenerateBackupCodes(String code) =>
      _codes('/profile/two-factor/backup-codes/regenerate', {'code': code});

  /// `POST /profile/two-factor/disable` — confirms with the password.
  Future<void> disableTwoFactor(String password) async {
    try {
      await _dio.post<void>(
        '/profile/two-factor/disable',
        data: {'password': password},
      );
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<List<String>> _codes(String path, Map<String, dynamic> body) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(path, data: body);
      final data = response.data!['data'] as Map<String, dynamic>;
      return (data['backupCodes'] as List).cast<String>();
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<StaffProfile> _patch(Map<String, dynamic> data) async {
    try {
      final response = await _dio.patch<Map<String, dynamic>>(
        '/profile',
        data: data,
      );
      return StaffProfile.fromJson(
        response.data!['data'] as Map<String, dynamic>,
      );
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
