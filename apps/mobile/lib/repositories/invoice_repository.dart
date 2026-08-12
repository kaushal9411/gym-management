import 'package:dio/dio.dart';

import '../core/network/api_exception.dart';
import '../models/member_invoice.dart';
import '../models/paginated_result.dart';

class InvoiceRepository {
  InvoiceRepository(this._dio);

  final Dio _dio;

  Future<PaginatedResult<MemberInvoice>> list({
    int page = 1,
    String? search,
  }) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        '/invoices',
        queryParameters: {
          'page': page,
          'limit': 20,
          if (search != null && search.isNotEmpty) 'search': search,
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
