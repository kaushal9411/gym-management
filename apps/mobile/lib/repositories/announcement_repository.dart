import 'package:dio/dio.dart';

import '../core/network/api_exception.dart';
import '../models/announcement.dart';
import '../models/paginated_result.dart';

class AnnouncementRepository {
  AnnouncementRepository(this._dio);

  final Dio _dio;

  Future<PaginatedResult<Announcement>> list({int page = 1}) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        '/tenant-announcements',
        queryParameters: {'page': page, 'limit': 20},
      );
      return PaginatedResult.fromJson(
        response.data!['data'] as Map<String, dynamic>,
        Announcement.fromJson,
      );
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<Announcement> create({
    required String title,
    required String body,
    required AnnouncementAudience audience,
  }) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        '/tenant-announcements',
        data: {'title': title, 'body': body, 'audience': audience.apiValue},
      );
      return Announcement.fromJson(
        response.data!['data'] as Map<String, dynamic>,
      );
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<void> publish(String id) async {
    try {
      await _dio.post<void>('/tenant-announcements/$id/publish');
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  /// `publishAt` must be a future ISO instant — the backend rejects past
  /// or unparsable values.
  Future<void> schedule(String id, DateTime publishAt) async {
    try {
      await _dio.post<void>(
        '/tenant-announcements/$id/schedule',
        data: {'publishAt': publishAt.toIso8601String()},
      );
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<void> delete(String id) async {
    try {
      await _dio.delete<void>('/tenant-announcements/$id');
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
