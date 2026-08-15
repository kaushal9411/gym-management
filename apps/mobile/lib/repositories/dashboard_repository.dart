import 'package:dio/dio.dart';

import '../core/network/api_exception.dart';
import '../models/dashboard_kpis.dart';
import '../models/recent_activity.dart';

class DashboardRepository {
  DashboardRepository(this._dio);

  final Dio _dio;

  Future<DashboardKpis> kpis({String? branchId}) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        '/reports/dashboard/kpis',
        queryParameters: {if (branchId != null) 'branchId': branchId},
      );
      return DashboardKpis.fromJson(
        response.data!['data'] as Map<String, dynamic>,
      );
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<List<RecentActivity>> recentActivities({String? branchId}) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        '/reports/dashboard/recent-activities',
        queryParameters: {if (branchId != null) 'branchId': branchId},
      );
      final list = response.data!['data'] as List;
      return list
          .map((e) => RecentActivity.fromJson(e as Map<String, dynamic>))
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
