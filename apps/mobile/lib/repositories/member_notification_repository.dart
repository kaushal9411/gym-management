import 'package:dio/dio.dart';

import '../core/network/api_exception.dart';
import '../models/paginated_result.dart';
import '../models/tenant_notification.dart';

/// Member-plane counterpart to `TenantNotificationRepository` — same
/// `TenantNotification` model (the response shape is identical), different
/// endpoints (`/portal/notifications*`, self-scoped to the signed-in member).
class MemberNotificationRepository {
  MemberNotificationRepository(this._dio);

  final Dio _dio;

  Future<PaginatedResult<TenantNotification>> list({int page = 1}) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        '/portal/notifications',
        queryParameters: {'page': page, 'limit': 20},
      );
      return PaginatedResult.fromJson(
        response.data!['data'] as Map<String, dynamic>,
        TenantNotification.fromJson,
      );
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<int> unreadCount() async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        '/portal/notifications/unread-count',
      );
      final data = response.data!['data'] as Map<String, dynamic>;
      return data['unreadCount'] as int;
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<void> markRead(String id) async {
    try {
      await _dio.post<void>('/portal/notifications/$id/read');
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<void> markAllRead() async {
    try {
      await _dio.post<void>('/portal/notifications/read-all');
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
