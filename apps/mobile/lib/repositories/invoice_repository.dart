import 'package:dio/dio.dart';

import '../core/network/api_exception.dart';
import '../models/invoice_analytics.dart';
import '../models/member_invoice.dart';
import '../models/paginated_result.dart';

class InvoiceRepository {
  InvoiceRepository(this._dio);

  final Dio _dio;

  Future<PaginatedResult<MemberInvoice>> list({
    int page = 1,
    int limit = 20,
    String? search,
    String? status,
    String? branchId,
  }) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        '/invoices',
        queryParameters: {
          'page': page,
          'limit': limit,
          if (search != null && search.isNotEmpty) 'search': search,
          if (status != null) 'status': status,
          if (branchId != null) 'branchId': branchId,
        },
      );
      return PaginatedResult.fromJson(
        response.data!['data'] as Map<String, dynamic>,
        MemberInvoice.fromJson,
      );
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  /// Same as [list] plus the filtered-set `summary` and tenant-wide status
  /// `counts` (both null when the server omits them).
  Future<
      ({
        PaginatedResult<MemberInvoice> page,
        InvoiceListSummary? summary,
        InvoiceCounts? counts,
      })> listWithSummary({
    int page = 1,
    int limit = 20,
    String? search,
    String? status,
    String? branchId,
    double? minAmount,
    double? maxAmount,
  }) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        '/invoices',
        queryParameters: {
          'page': page,
          'limit': limit,
          if (search != null && search.isNotEmpty) 'search': search,
          if (status != null) 'status': status,
          if (branchId != null) 'branchId': branchId,
          if (minAmount != null) 'minAmount': minAmount,
          if (maxAmount != null) 'maxAmount': maxAmount,
        },
      );
      final data = response.data!['data'] as Map<String, dynamic>;
      final summary = data['summary'];
      final counts = data['counts'];
      return (
        page: PaginatedResult.fromJson(data, MemberInvoice.fromJson),
        summary: summary is Map<String, dynamic>
            ? InvoiceListSummary.fromJson(summary)
            : null,
        counts: counts is Map<String, dynamic>
            ? InvoiceCounts.fromJson(counts)
            : null,
      );
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<InvoiceAnalytics> analytics({
    required String dateFrom,
    required String dateTo,
    String? branchId,
  }) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        '/invoices/analytics',
        queryParameters: {
          'dateFrom': dateFrom,
          'dateTo': dateTo,
          if (branchId != null) 'branchId': branchId,
        },
      );
      return InvoiceAnalytics.fromJson(
        response.data!['data'] as Map<String, dynamic>,
      );
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<MemberInvoice> getById(String invoiceId) async {
    try {
      final response =
          await _dio.get<Map<String, dynamic>>('/invoices/$invoiceId');
      return MemberInvoice.fromJson(
        response.data!['data'] as Map<String, dynamic>,
      );
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<void> email(String invoiceId) async {
    try {
      await _dio.post<void>('/invoices/$invoiceId/email', data: {});
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
