import 'package:dio/dio.dart';

import '../core/network/api_exception.dart';
import '../models/business_hours.dart';
import '../models/gym_branding.dart';
import '../models/gym_business_settings.dart';
import '../models/gym_email_notification_settings.dart';
import '../models/gym_profile.dart';
import '../models/tenant_ai_settings.dart';

class GymSettingsRepository {
  GymSettingsRepository(this._dio);

  final Dio _dio;

  Future<GymProfile> getProfile() async {
    try {
      final response =
          await _dio.get<Map<String, dynamic>>('/settings/profile');
      return GymProfile.fromJson(
        response.data!['data'] as Map<String, dynamic>,
      );
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  /// `PATCH /settings/profile` (perm `settings:manage`) — web's "Basic
  /// information" block. Blank optional fields are sent as `null`, like web.
  Future<GymProfile> updateProfile({
    required String gymName,
    String? legalBusinessName,
    String? registrationNumber,
    String? gstVatNumber,
    String? businessType,
    String? description,
  }) =>
      _patchProfile('/settings/profile', {
        'gymName': gymName,
        'legalBusinessName': _orNull(legalBusinessName),
        'registrationNumber': _orNull(registrationNumber),
        'gstVatNumber': _orNull(gstVatNumber),
        'businessType': _orNull(businessType),
        'description': _orNull(description),
      });

  /// `PATCH /settings/profile/contact` — web's "Contact information" block.
  Future<GymProfile> updateContact({
    String? email,
    String? phone,
    String? alternatePhone,
    String? website,
    String? addressLine,
    String? city,
    String? state,
    String? country,
    String? postalCode,
    double? latitude,
    double? longitude,
  }) =>
      _patchProfile('/settings/profile/contact', {
        'email': _orNull(email),
        'phone': _orNull(phone),
        'alternatePhone': _orNull(alternatePhone),
        'website': _orNull(website),
        'addressLine': _orNull(addressLine),
        'city': _orNull(city),
        'state': _orNull(state),
        'country': _orNull(country),
        'postalCode': _orNull(postalCode),
        'latitude': latitude,
        'longitude': longitude,
      });

  /// `PATCH /settings/profile/business-hours` — the whole week is replaced.
  Future<GymProfile> updateBusinessHours(BusinessHours hours) =>
      _patchProfile('/settings/profile/business-hours', hours.toJson());

  Future<GymProfile> _patchProfile(String path, Object body) async {
    try {
      final response = await _dio.patch<Map<String, dynamic>>(path, data: body);
      return GymProfile.fromJson(
        response.data!['data'] as Map<String, dynamic>,
      );
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  /// `PATCH /settings/profile/social-links` — a distinct endpoint from the
  /// rest of the profile, scoped to just the five link fields. The
  /// backend's `urlOrEmptySchema` treats `''` (not `null`) as "clear this
  /// field", so blank fields are sent as empty strings.
  Future<GymProfile> updateSocialLinks({
    String? facebook,
    String? instagram,
    String? twitter,
    String? youtube,
    String? linkedin,
  }) async {
    try {
      final response = await _dio.patch<Map<String, dynamic>>(
        '/settings/profile/social-links',
        data: {
          'facebook': facebook ?? '',
          'instagram': instagram ?? '',
          'twitter': twitter ?? '',
          'youtube': youtube ?? '',
          'linkedin': linkedin ?? '',
        },
      );
      return GymProfile.fromJson(
        response.data!['data'] as Map<String, dynamic>,
      );
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<GymBusinessSettings> getBusinessSettings() async {
    try {
      final response =
          await _dio.get<Map<String, dynamic>>('/settings/business');
      return GymBusinessSettings.fromJson(
        response.data!['data'] as Map<String, dynamic>,
      );
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<GymBusinessSettings> updateBusinessSettings({
    required String currency,
    required String currencySymbol,
    required String timezone,
    required String dateFormat,
    required String timeFormat,
    required MeasurementUnit measurementUnit,
    int? weekStartDay,
    String? locale,
  }) async {
    try {
      final response = await _dio.patch<Map<String, dynamic>>(
        '/settings/business',
        data: {
          'currency': currency,
          'currencySymbol': currencySymbol,
          'timezone': timezone,
          'dateFormat': dateFormat,
          'timeFormat': timeFormat,
          'measurementUnit': measurementUnit.apiValue,
          if (weekStartDay != null) 'weekStartDay': weekStartDay,
          if (locale != null) 'locale': locale,
        },
      );
      return GymBusinessSettings.fromJson(
        response.data!['data'] as Map<String, dynamic>,
      );
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<GymEmailSettings> getEmailSettings() async {
    try {
      final response = await _dio.get<Map<String, dynamic>>('/settings/email');
      return GymEmailSettings.fromJson(
        response.data!['data'] as Map<String, dynamic>,
      );
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<GymEmailSettings> updateEmailSettings({
    String? emailFromName,
    String? emailFromAddress,
  }) async {
    try {
      final response = await _dio.patch<Map<String, dynamic>>(
        '/settings/email',
        data: {
          'emailFromName': _orNull(emailFromName),
          'emailFromAddress': _orNull(emailFromAddress),
        },
      );
      return GymEmailSettings.fromJson(
        response.data!['data'] as Map<String, dynamic>,
      );
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<GymNotificationSettings> getNotificationSettings() async {
    try {
      final response =
          await _dio.get<Map<String, dynamic>>('/settings/notifications');
      return GymNotificationSettings.fromJson(
        response.data!['data'] as Map<String, dynamic>,
      );
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<GymNotificationSettings> updateNotificationSettings(
    GymNotificationSettings settings,
  ) async {
    try {
      final response = await _dio.patch<Map<String, dynamic>>(
        '/settings/notifications',
        data: settings.toJson(),
      );
      return GymNotificationSettings.fromJson(
        response.data!['data'] as Map<String, dynamic>,
      );
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<GymBranding> getBranding() async {
    try {
      final response =
          await _dio.get<Map<String, dynamic>>('/settings/branding');
      return GymBranding.fromJson(
        response.data!['data'] as Map<String, dynamic>,
      );
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  /// `PATCH /settings/branding`. Like web, a blank secondary colour or welcome
  /// message is left out of the payload rather than cleared.
  Future<GymBranding> updateBranding({
    String? primaryColor,
    String? secondaryColor,
    String? theme,
    String? welcomeMessage,
  }) async {
    try {
      final response = await _dio.patch<Map<String, dynamic>>(
        '/settings/branding',
        data: {
          if (primaryColor != null) 'primaryColor': primaryColor,
          if (secondaryColor != null && secondaryColor.isNotEmpty)
            'secondaryColor': secondaryColor,
          if (theme != null) 'theme': theme,
          if (welcomeMessage != null && welcomeMessage.isNotEmpty)
            'welcomeMessage': welcomeMessage,
        },
      );
      return GymBranding.fromJson(
        response.data!['data'] as Map<String, dynamic>,
      );
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  /// `POST /settings/branding/logo` — a base64 `data:` URL (the API's 1 MB
  /// body cap applies; the caller shrinks the picture first).
  Future<GymBranding> uploadLogo(String dataUrl) =>
      _upload('/settings/branding/logo', {'dataUrl': dataUrl});

  /// `POST /settings/branding/favicon`.
  Future<GymBranding> uploadFavicon(String dataUrl) =>
      _upload('/settings/branding/favicon', {'dataUrl': dataUrl});

  /// `POST /settings/branding/upload` for the other three images; [field] is
  /// `loginBackgroundUrl`, `dashboardBannerUrl` or `emailLogoUrl`.
  Future<GymBranding> uploadBrandingAsset(String field, String dataUrl) =>
      _upload(
        '/settings/branding/upload',
        {'field': field, 'dataUrl': dataUrl},
      );

  Future<GymBranding> _upload(String path, Object body) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(path, data: body);
      return GymBranding.fromJson(
        response.data!['data'] as Map<String, dynamic>,
      );
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<GymInvoiceSettings> getInvoiceSettings() async {
    try {
      final response =
          await _dio.get<Map<String, dynamic>>('/settings/invoice');
      return GymInvoiceSettings.fromJson(
        response.data!['data'] as Map<String, dynamic>,
      );
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<GymInvoiceSettings> updateInvoiceSettings({
    required String invoicePrefix,
    required double taxPercentage,
    required int defaultPaymentTermsDays,
    String? invoiceFooter,
  }) async {
    try {
      final response = await _dio.patch<Map<String, dynamic>>(
        '/settings/invoice',
        data: {
          'invoicePrefix': invoicePrefix,
          'taxPercentage': taxPercentage,
          'defaultPaymentTermsDays': defaultPaymentTermsDays,
          'invoiceFooter': _orNull(invoiceFooter),
        },
      );
      return GymInvoiceSettings.fromJson(
        response.data!['data'] as Map<String, dynamic>,
      );
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<GymSecuritySettings> getSecuritySettings() async {
    try {
      final response =
          await _dio.get<Map<String, dynamic>>('/settings/security');
      return GymSecuritySettings.fromJson(
        response.data!['data'] as Map<String, dynamic>,
      );
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  /// The whole policy is one array — a PATCH replaces it, so callers send
  /// the complete set of roles that must use 2FA, not a delta.
  Future<GymSecuritySettings> updateSecuritySettings(
    List<String> mfaRequiredRoles,
  ) async {
    try {
      final response = await _dio.patch<Map<String, dynamic>>(
        '/settings/security',
        data: {'mfaRequiredRoles': mfaRequiredRoles},
      );
      return GymSecuritySettings.fromJson(
        response.data!['data'] as Map<String, dynamic>,
      );
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  /// `GET /ai/settings` (perms `settings:read` + `ai:use`, module `ai_coach`).
  Future<TenantAiSettings> getAiSettings() async {
    try {
      final response = await _dio.get<Map<String, dynamic>>('/ai/settings');
      return TenantAiSettings.fromJson(
        response.data!['data'] as Map<String, dynamic>,
      );
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  /// `PUT /ai/settings` (`settings:manage`). Provider / model / base URL are
  /// strings (blank = platform default); temperature and max tokens are only
  /// sent when set; [apiKey] only when typed, or `''` to clear the saved one.
  Future<TenantAiSettings> updateAiSettings({
    required String provider,
    required String model,
    required String baseUrl,
    double? temperature,
    int? maxTokens,
    String? apiKey,
  }) async {
    try {
      final response = await _dio.put<Map<String, dynamic>>(
        '/ai/settings',
        data: {
          'provider': provider,
          'model': model,
          'baseUrl': baseUrl,
          if (temperature != null) 'temperature': temperature,
          if (maxTokens != null) 'maxTokens': maxTokens,
          if (apiKey != null) 'apiKey': apiKey,
        },
      );
      return TenantAiSettings.fromJson(
        response.data!['data'] as Map<String, dynamic>,
      );
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  /// `DELETE /ai/settings` — back to the platform default.
  Future<void> resetAiSettings() async {
    try {
      await _dio.delete<void>('/ai/settings');
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  String? _orNull(String? value) =>
      value == null || value.isEmpty ? null : value;

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
