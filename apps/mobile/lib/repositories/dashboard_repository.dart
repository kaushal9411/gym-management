import 'package:dio/dio.dart';

import '../core/network/api_exception.dart';
import '../models/dashboard_kpis.dart';
import '../models/recent_activity.dart';
import '../models/revenue_trend_point.dart';

class DashboardRepository {
  DashboardRepository(this._dio);

  final Dio _dio;

  Future<DashboardKpis> kpis() async {
    try {
      final response =
          await _dio.get<Map<String, dynamic>>('/reports/dashboard/kpis');
      return DashboardKpis.fromJson(
        response.data!['data'] as Map<String, dynamic>,
      );
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<List<RecentActivity>> recentActivities() async {
    try {
      final response = await _dio
          .get<Map<String, dynamic>>('/reports/dashboard/recent-activities');
      final list = response.data!['data'] as List;
      return list
          .map((e) => RecentActivity.fromJson(e as Map<String, dynamic>))
          .toList();
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  /// Last 7 days (inclusive) of income vs expenses — backs the Home
  /// screen's revenue sparkline.
  Future<List<RevenueTrendPoint>> revenueTrendsLast7Days() async {
    final today = DateTime.now();
    final from = today.subtract(const Duration(days: 6));
    String iso(DateTime d) => d.toIso8601String().substring(0, 10);
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        '/analytics/revenue-trends',
        queryParameters: {'dateFrom': iso(from), 'dateTo': iso(today)},
      );
      final list = response.data!['data'] as List;
      return list
          .map((e) => RevenueTrendPoint.fromJson(e as Map<String, dynamic>))
          .toList();
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
