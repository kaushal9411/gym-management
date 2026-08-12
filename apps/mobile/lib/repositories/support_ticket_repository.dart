import 'package:dio/dio.dart';

import '../core/network/api_exception.dart';
import '../models/paginated_result.dart';
import '../models/support_ticket.dart';

class SupportTicketRepository {
  SupportTicketRepository(this._dio);

  final Dio _dio;

  Future<PaginatedResult<SupportTicket>> list({int page = 1}) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        '/support/tickets',
        queryParameters: {'page': page, 'limit': 20},
      );
      return PaginatedResult.fromJson(
        response.data!['data'] as Map<String, dynamic>,
        SupportTicket.fromJson,
      );
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<SupportTicket> getById(String ticketId) async {
    try {
      final response =
          await _dio.get<Map<String, dynamic>>('/support/tickets/$ticketId');
      return SupportTicket.fromJson(
        response.data!['data'] as Map<String, dynamic>,
      );
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<SupportTicket> create({
    required String subject,
    required String description,
    required TicketPriority priority,
  }) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        '/support/tickets',
        data: {
          'subject': subject,
          'description': description,
          'priority': priority.apiValue,
        },
      );
      return SupportTicket.fromJson(
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
