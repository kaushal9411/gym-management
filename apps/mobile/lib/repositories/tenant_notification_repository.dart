import 'package:dio/dio.dart';

import '../core/network/api_exception.dart';
import '../models/notification_stats.dart';
import '../models/notification_template.dart';
import '../models/paginated_result.dart';
import '../models/tenant_notification.dart';

class TenantNotificationRepository {
  TenantNotificationRepository(this._dio);

  final Dio _dio;

  Future<PaginatedResult<TenantNotification>> list({int page = 1}) async =>
      (await listWithCounts(page: page)).page;

  /// `GET /notifications` with the server-side `category` / `search` /
  /// `unreadOnly` filters, plus the feed-wide `counts:{all,unread}` block
  /// (null if an older API omits it).
  Future<
      ({
        PaginatedResult<TenantNotification> page,
        NotificationCounts? counts,
      })> listWithCounts({
    int page = 1,
    String? category,
    String? search,
    bool unreadOnly = false,
  }) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        '/notifications',
        queryParameters: {
          'page': page,
          'limit': 20,
          if (category != null) 'category': category,
          if (search != null && search.trim().isNotEmpty)
            'search': search.trim(),
          if (unreadOnly) 'unreadOnly': true,
        },
      );
      final data = response.data!['data'] as Map<String, dynamic>;
      return (
        page: PaginatedResult.fromJson(data, TenantNotification.fromJson),
        counts: NotificationCounts.tryParse(data['counts']),
      );
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  /// `GET /notifications/stats` (perm `notifications:view`).
  Future<NotificationStats> stats({
    required String dateFrom,
    required String dateTo,
  }) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        '/notifications/stats',
        queryParameters: {'dateFrom': dateFrom, 'dateTo': dateTo},
      );
      return NotificationStats.fromJson(
        response.data!['data'] as Map<String, dynamic>,
      );
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<int> unreadCount() async {
    try {
      final response =
          await _dio.get<Map<String, dynamic>>('/notifications/unread-count');
      final data = response.data!['data'] as Map<String, dynamic>;
      return data['unreadCount'] as int;
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<void> markRead(String id) async {
    try {
      await _dio.post<void>('/notifications/$id/read');
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<void> markAllRead() async {
    try {
      await _dio.post<void>('/notifications/read-all');
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<List<NotificationTemplate>> listTemplates() async {
    try {
      final response =
          await _dio.get<Map<String, dynamic>>('/notifications/templates');
      final list = response.data!['data'] as List;
      return list
          .map(
            (e) => NotificationTemplate.fromJson(e as Map<String, dynamic>),
          )
          .toList();
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<NotificationTemplate> updateTemplate(
    String type, {
    required List<String> channels,
    required String titleTemplate,
    required String bodyTemplate,
    required bool isActive,
  }) async {
    try {
      final response = await _dio.patch<Map<String, dynamic>>(
        '/notifications/templates/$type',
        data: {
          'channels': channels,
          'titleTemplate': titleTemplate,
          'bodyTemplate': bodyTemplate,
          'isActive': isActive,
        },
      );
      return NotificationTemplate.fromJson(
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
