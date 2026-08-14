import 'package:dio/dio.dart';

import '../core/network/api_exception.dart';
import '../models/staff_profile.dart';

/// Staff plane's own-account profile — `GET/PATCH /profile`. Distinct from
/// `AuthRepository.me()` (`/auth/me`, roles+permissions for the header
/// avatar/greeting); this is the fuller self-service record (avatar,
/// branch access, emergency contact, notification prefs). Email is
/// deliberately never sent here — the backend requires `users:manage` to
/// change it, so it isn't part of self-service profile editing.
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

  /// Whole-form save, like `GymSettingsRepository.saveProfile` — the caller
  /// always sends every field's current edited value. `avatarUrl` is a
  /// data: URL (base64) or `null` to clear the photo.
  Future<StaffProfile> updateProfile({
    required String name,
    String? phone,
    String? avatarUrl,
    String? emergencyContactName,
    String? emergencyContactPhone,
    String? emergencyContactRelation,
    Map<String, bool>? notificationPreferences,
  }) async {
    try {
      final response = await _dio.patch<Map<String, dynamic>>(
        '/profile',
        data: {
          'name': name,
          'phone': phone,
          'avatarUrl': avatarUrl,
          'emergencyContactName': emergencyContactName,
          'emergencyContactPhone': emergencyContactPhone,
          'emergencyContactRelation': emergencyContactRelation,
          if (notificationPreferences != null)
            'notificationPreferences': notificationPreferences,
        },
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
