import 'package:dio/dio.dart';

import '../core/network/api_exception.dart';
import '../models/member_payment.dart';
import '../models/paginated_result.dart';
import '../models/payable_invoice.dart';
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
  ///
  /// [dateFrom] / [dateTo] are sent as full UTC instants — the server does
  /// `paymentDate <= new Date(dateTo)`, so a bare `YYYY-MM-DD` would be
  /// midnight and drop every payment made later that day. The screen passes
  /// `…T00:00:00.000Z` / `…T23:59:59.999Z`.
  Future<({PaginatedResult<MemberPayment> page, PaymentListSummary? summary})>
      listWithSummary({
    int page = 1,
    String? search,
    String? status,
    String? method,
    String? planId,
    String? branchId,
    double? minAmount,
    double? maxAmount,
    String? dateFrom,
    String? dateTo,
    String? sortBy,
    String? sortDir,
  }) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        '/payments',
        queryParameters: {
          'page': page,
          'limit': 20,
          if (search != null && search.isNotEmpty) 'search': search,
          if (status != null) 'status': status,
          if (method != null) 'method': method,
          if (planId != null) 'planId': planId,
          if (branchId != null) 'branchId': branchId,
          if (minAmount != null) 'minAmount': minAmount,
          if (maxAmount != null) 'maxAmount': maxAmount,
          if (dateFrom != null) 'dateFrom': dateFrom,
          if (dateTo != null) 'dateTo': dateTo,
          if (sortBy != null) 'sortBy': sortBy,
          if (sortDir != null) 'sortDir': sortDir,
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
    String? memberId,
    int limit = 20,
  }) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        '/payments',
        queryParameters: {
          'page': page,
          'limit': limit,
          if (memberId != null) 'memberId': memberId,
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

  /// `POST /payments/:id/verify` (perm `finance:payment-create`). For a
  /// PENDING online payment this polls Razorpay and may flip the row to
  /// SUCCESS / FAILED; for anything else it just echoes the current status.
  /// Returns the status string (`SUCCESS`, `PENDING`, ...).
  Future<String> verify(String paymentId) async {
    try {
      final response =
          await _dio.post<Map<String, dynamic>>('/payments/$paymentId/verify');
      final data = response.data?['data'];
      return data is Map<String, dynamic>
          ? (data['status']?.toString() ?? '')
          : '';
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  /// `POST /payments/:id/razorpay/notify` (perm `finance:payment-create`) —
  /// resends the payment-link notification. [medium] is `email` or `sms`.
  Future<void> resendLink(String paymentId, String medium) async {
    try {
      await _dio.post<void>(
        '/payments/$paymentId/razorpay/notify',
        data: {'medium': medium},
      );
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  /// Web's "Invoice (optional)" step: the member's UNPAID / PARTIALLY_PAID
  /// invoices (latest 20, filtered on the device like web). Needs
  /// `finance:invoice-view` — callers treat a failure as "no invoices".
  Future<List<PayableInvoice>> outstandingInvoices(String memberId) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        '/invoices',
        queryParameters: {
          'page': 1,
          'limit': 20,
          'memberId': memberId,
          'sortBy': 'createdAt',
          'sortDir': 'desc',
        },
      );
      final items = (response.data!['data'] as Map<String, dynamic>)['items'];
      if (items is! List) return const [];
      return items
          .whereType<Map<String, dynamic>>()
          .map(PayableInvoice.fromJson)
          .where((i) => i.status == 'UNPAID' || i.status == 'PARTIALLY_PAID')
          .toList();
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  /// `GET /invoices/:id` reduced to total / paid-so-far (SUCCESS payments).
  Future<InvoiceDue> invoiceDue(String invoiceId) async {
    try {
      final response =
          await _dio.get<Map<String, dynamic>>('/invoices/$invoiceId');
      return InvoiceDue.fromJson(
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
