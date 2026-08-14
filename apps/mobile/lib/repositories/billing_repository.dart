import 'package:dio/dio.dart';

import '../core/network/api_exception.dart';
import '../models/billing_address.dart';
import '../models/fitcloud_invoice.dart';
import '../models/subscription_plan_info.dart';

class BillingRepository {
  BillingRepository(this._dio);

  final Dio _dio;

  /// Null when the tenant has no subscription row at all (404 `NOT_FOUND`) —
  /// a real, non-error state for tenants provisioned outside onboarding.
  Future<TenantSubscription?> currentSubscription() async {
    try {
      final response = await _dio.get<Map<String, dynamic>>('/subscription');
      return TenantSubscription.fromJson(
        response.data!['data'] as Map<String, dynamic>,
      );
    } on DioException catch (e) {
      if (e.response?.statusCode == 404) return null;
      throw _mapError(e);
    }
  }

  Future<List<FitCloudInvoice>> invoices() async {
    try {
      final response = await _dio.get<Map<String, dynamic>>('/invoice');
      final list = response.data!['data'] as List;
      return list
          .map((e) => FitCloudInvoice.fromJson(e as Map<String, dynamic>))
          .toList();
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  /// Null when the tenant hasn't set one yet — the endpoint itself returns
  /// `data: null` for this case (not a 404), verified live.
  Future<BillingAddress?> getAddress() async {
    try {
      final response =
          await _dio.get<Map<String, dynamic>>('/billing/address');
      final data = response.data!['data'];
      return data == null
          ? null
          : BillingAddress.fromJson(data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  /// Creates or replaces the tenant's billing address in one call — the
  /// endpoint is a full upsert, not a partial PATCH.
  Future<BillingAddress> saveAddress({
    String? legalName,
    required String line1,
    String? line2,
    required String city,
    required String state,
    required String postalCode,
    required String country,
    String? taxId,
  }) async {
    try {
      final response = await _dio.put<Map<String, dynamic>>(
        '/billing/address',
        data: {
          if (legalName != null && legalName.isNotEmpty)
            'legalName': legalName,
          'line1': line1,
          if (line2 != null && line2.isNotEmpty) 'line2': line2,
          'city': city,
          'state': state,
          'postalCode': postalCode,
          'country': country.toUpperCase(),
          if (taxId != null && taxId.isNotEmpty) 'taxId': taxId,
        },
      );
      return BillingAddress.fromJson(
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
