import 'package:dio/dio.dart';

import '../core/network/api_exception.dart';
import '../models/paginated_result.dart';
import '../models/support_ticket.dart';
import '../models/support_ticket_stats.dart';

class SupportTicketRepository {
  SupportTicketRepository(this._dio);

  final Dio _dio;

  Future<PaginatedResult<SupportTicket>> list({int page = 1}) async =>
      (await listWithCounts(page: page)).page;

  /// `GET /support/tickets` with the server-side `status` filter plus the
  /// `counts` block (status chip badges; null if an older API omits it).
  Future<
      ({
        PaginatedResult<SupportTicket> page,
        SupportTicketCounts? counts,
      })> listWithCounts({int page = 1, String? status}) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        '/support/tickets',
        queryParameters: {
          'page': page,
          'limit': 20,
          if (status != null) 'status': status,
        },
      );
      final data = response.data!['data'] as Map<String, dynamic>;
      return (
        page: PaginatedResult.fromJson(data, SupportTicket.fromJson),
        counts: SupportTicketCounts.tryParse(data['counts']),
      );
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  /// `GET /support/tickets/stats` (perm `support:view`).
  Future<SupportTicketStats> stats({
    required String dateFrom,
    required String dateTo,
  }) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        '/support/tickets/stats',
        queryParameters: {'dateFrom': dateFrom, 'dateTo': dateTo},
      );
      return SupportTicketStats.fromJson(
        response.data!['data'] as Map<String, dynamic>,
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
