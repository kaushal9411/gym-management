import 'package:dio/dio.dart';

import '../core/network/api_exception.dart';
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
