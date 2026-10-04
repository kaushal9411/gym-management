import 'package:dio/dio.dart';

import '../core/network/api_exception.dart';
import '../models/announcement.dart';
import '../models/announcement_stats.dart';
import '../models/paginated_result.dart';
import '../models/platform_announcement.dart';

class AnnouncementRepository {
  AnnouncementRepository(this._dio);

  final Dio _dio;

  /// `GET /announcements/active` — Super Admin platform notices currently
  /// targeting this tenant (audience + expiry already filtered server-side).
  /// Backs the Owner dashboard's "Announcements" card; unrelated to
  /// [list]/[create]/etc. below, which manage the tenant's own announcements.
  Future<List<PlatformAnnouncement>> listActivePlatform() async {
    try {
      final response =
          await _dio.get<Map<String, dynamic>>('/announcements/active');
      final list = response.data!['data'] as List;
      return list
          .map(
            (e) => PlatformAnnouncement.fromJson(e as Map<String, dynamic>),
          )
          .toList();
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<PaginatedResult<Announcement>> list({int page = 1}) async =>
      (await listWithCounts(page: page)).page;

  /// `GET /tenant-announcements` with the server-side `status` / `audience`
  /// / `search` filters plus the `counts` block (status-tab badges; null if
  /// an older API omits it).
  Future<
      ({
        PaginatedResult<Announcement> page,
        AnnouncementCounts? counts,
      })> listWithCounts({
    int page = 1,
    String? status,
    AnnouncementAudience? audience,
    String? search,
  }) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        '/tenant-announcements',
        queryParameters: {
          'page': page,
          'limit': 20,
          if (status != null) 'status': status,
          if (audience != null) 'audience': audience.apiValue,
          if (search != null && search.trim().isNotEmpty)
            'search': search.trim(),
        },
      );
      final data = response.data!['data'] as Map<String, dynamic>;
      return (
        page: PaginatedResult.fromJson(data, Announcement.fromJson),
        counts: AnnouncementCounts.tryParse(data['counts']),
      );
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  /// `GET /tenant-announcements/stats` (perm `announcements:view`).
  Future<AnnouncementStats> stats({
    required String dateFrom,
    required String dateTo,
  }) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        '/tenant-announcements/stats',
        queryParameters: {'dateFrom': dateFrom, 'dateTo': dateTo},
      );
      return AnnouncementStats.fromJson(
        response.data!['data'] as Map<String, dynamic>,
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
