import 'package:dio/dio.dart';

import '../core/network/api_exception.dart';
import '../models/gym_branding.dart';
import '../models/gym_business_settings.dart';
import '../models/gym_profile.dart';

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

  /// Both `gymName` (via `/settings/profile`) and the contact fields (via
  /// `/settings/profile/contact`) in one call — two backend resources, one
  /// screen-level save action.
  Future<GymProfile> saveProfile({
    required String gymName,
    String? legalBusinessName,
    String? email,
    String? phone,
    String? website,
    String? addressLine,
    String? city,
    String? state,
    String? country,
    String? postalCode,
  }) async {
    try {
      await _dio.patch<void>(
        '/settings/profile',
        data: {
          'gymName': gymName,
          if (legalBusinessName != null)
            'legalBusinessName': _orNull(legalBusinessName),
        },
      );
      final response = await _dio.patch<Map<String, dynamic>>(
        '/settings/profile/contact',
        data: {
          'email': _orNull(email),
          'phone': _orNull(phone),
          'website': _orNull(website),
          'addressLine': _orNull(addressLine),
          'city': _orNull(city),
          'state': _orNull(state),
          'country': _orNull(country),
          'postalCode': _orNull(postalCode),
        },
      );
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
        },
      );
      return GymBusinessSettings.fromJson(
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

  Future<GymBranding> updateBranding({
    String? primaryColor,
    String? secondaryColor,
    String? theme,
  }) async {
    try {
      final response = await _dio.patch<Map<String, dynamic>>(
        '/settings/branding',
        data: {
          if (primaryColor != null) 'primaryColor': primaryColor,
          if (secondaryColor != null) 'secondaryColor': secondaryColor,
          if (theme != null) 'theme': theme,
        },
      );
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
