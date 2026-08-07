import 'package:dio/dio.dart';

import '../../../core/errors/app_exception.dart';
import 'dashboard_models.dart';

class DashboardRepository {
  final Dio _dio;
  DashboardRepository(this._dio);

  Future<DashboardKpis> fetchKpis() async {
    try {
      final response =
          await _dio.get<Map<String, dynamic>>('/reports/dashboard/kpis');
      return DashboardKpis.fromJson(
        response.data!['data'] as Map<String, dynamic>,
      );
    } on DioException catch (e) {
      throw AppException.fromDioData(e.response?.data, e.response?.statusCode);
    }
  }

  Future<List<Announcement>> fetchActiveAnnouncements() async {
    try {
      final response =
          await _dio.get<Map<String, dynamic>>('/announcements/active');
      final list = response.data!['data'] as List;
      return list
          .map((e) => Announcement.fromJson(e as Map<String, dynamic>))
          .toList();
    } on DioException {
      return const []; // non-critical widget — never block the dashboard on this
    }
  }

  Future<List<RecentActivity>> fetchRecentActivities() async {
    try {
      final response = await _dio
          .get<Map<String, dynamic>>('/reports/dashboard/recent-activities');
      final list = response.data!['data'] as List;
      return list
          .map((e) => RecentActivity.fromJson(e as Map<String, dynamic>))
          .take(3)
          .toList();
    } on DioException {
      return const []; // non-critical widget — never block the dashboard on this
    }
  }

  /// The design's "Revenue trend · 7 days" card — last 7 calendar days inclusive.
  Future<List<RevenueTrendPoint>> fetchRevenueTrend() async {
    try {
      final now = DateTime.now();
      final from = now.subtract(const Duration(days: 6));
      String iso(DateTime d) =>
          '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';
      final response = await _dio.get<Map<String, dynamic>>(
        '/analytics/revenue-trends',
        queryParameters: {'dateFrom': iso(from), 'dateTo': iso(now)},
      );
      final list = response.data!['data'] as List;
      return list
          .map((e) => RevenueTrendPoint.fromJson(e as Map<String, dynamic>))
          .toList();
    } on DioException {
      return const []; // non-critical widget — never block the dashboard on this
    }
  }
}
