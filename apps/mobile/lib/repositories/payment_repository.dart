import 'package:dio/dio.dart';

import '../core/network/api_exception.dart';
import '../models/member_payment.dart';
import '../models/paginated_result.dart';
import '../models/payments_analytics.dart';

/// `/payments` — the member-payment ledger (distinct from `/portal/*`, and
/// from the Billing module's FitCloud-subscription invoices).
class PaymentRepository {
  PaymentRepository(this._dio);

  final Dio _dio;

  /// `GET /payments/analytics` (perm `finance:view`). Dates are
  /// `YYYY-MM-DD` UTC days; omit both for the backend default (this month).
  Future<PaymentsAnalytics> analytics({
    String? dateFrom,
    String? dateTo,
    String? branchId,
  }) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        '/payments/analytics',
        queryParameters: {
          if (dateFrom != null) 'dateFrom': dateFrom,
          if (dateTo != null) 'dateTo': dateTo,
          if (branchId != null) 'branchId': branchId,
        },
      );
      return PaymentsAnalytics.fromJson(
        response.data!['data'] as Map<String, dynamic>,
      );
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  /// Also returns the filtered-set `summary` (separate from [list] so the
  /// generic `PaginatedListCubit` closure can still use the page envelope).
  Future<({PaginatedResult<MemberPayment> page, PaymentListSummary? summary})>
      listWithSummary({
    int page = 1,
    String? search,
    String? status,
    String? planId,
    double? minAmount,
    double? maxAmount,
  }) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        '/payments',
        queryParameters: {
          'page': page,
          'limit': 20,
          if (search != null && search.isNotEmpty) 'search': search,
          if (status != null) 'status': status,
          if (planId != null) 'planId': planId,
          if (minAmount != null) 'minAmount': minAmount,
          if (maxAmount != null) 'maxAmount': maxAmount,
        },
      );
      final data = response.data!['data'] as Map<String, dynamic>;
      final summary = data['summary'];
      return (
        page: PaginatedResult.fromJson(data, MemberPayment.fromJson),
        summary: summary is Map<String, dynamic>
            ? PaymentListSummary.fromJson(summary)
            : null,
      );
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<PaginatedResult<MemberPayment>> list({
    int page = 1,
    String? search,
    String? status,
  }) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        '/payments',
        queryParameters: {
          'page': page,
          'limit': 20,
          if (search != null && search.isNotEmpty) 'search': search,
          if (status != null) 'status': status,
        },
      );
      return PaginatedResult.fromJson(
        response.data!['data'] as Map<String, dynamic>,
        MemberPayment.fromJson,
      );
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<MemberPayment> getById(String paymentId) async {
    try {
      final response =
          await _dio.get<Map<String, dynamic>>('/payments/$paymentId');
      return MemberPayment.fromJson(
        response.data!['data'] as Map<String, dynamic>,
      );
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  /// Omitting [amount] refunds the full remaining balance. Needs
  /// `finance:payment-refund`, a stricter grant than the `finance:view` the
  /// rest of this repository uses.
  Future<MemberPayment> refund(
    String paymentId, {
    double? amount,
    String? reason,
  }) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        '/payments/$paymentId/refund',
        data: {
          if (amount != null) 'amount': amount,
          if (reason != null && reason.isNotEmpty) 'reason': reason,
        },
      );
      return MemberPayment.fromJson(
        response.data!['data'] as Map<String, dynamic>,
      );
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  /// Unlike `refund`, cancel responds with `data: null` — verified live — so
  /// there's nothing to parse and callers must re-fetch to show the new
  /// status.
  Future<void> cancel(String paymentId) async {
    try {
      await _dio.post<void>('/payments/$paymentId/cancel');
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
