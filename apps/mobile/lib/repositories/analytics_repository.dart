import 'package:dio/dio.dart';

import '../core/network/api_exception.dart';
import '../models/revenue_trend_point.dart';
import '../models/trend_point.dart';

/// `/analytics/*` — daily trend series over an arbitrary date range,
/// optionally scoped to one branch.
class AnalyticsRepository {
  AnalyticsRepository(this._dio);

  final Dio _dio;

  String _iso(DateTime d) => d.toIso8601String().substring(0, 10);

  Map<String, dynamic> _params(DateTime from, DateTime to, String? branchId) =>
      {
        'dateFrom': _iso(from),
        'dateTo': _iso(to),
        if (branchId != null) 'branchId': branchId,
      };

  Future<List<RevenueTrendPoint>> revenueTrends({
    required DateTime from,
    required DateTime to,
    String? branchId,
  }) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        '/analytics/revenue-trends',
        queryParameters: _params(from, to, branchId),
      );
      final list = response.data!['data'] as List;
      return list
          .map((e) => RevenueTrendPoint.fromJson(e as Map<String, dynamic>))
          .toList();
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<List<TrendPoint>> attendanceTrends({
    required DateTime from,
    required DateTime to,
    String? branchId,
  }) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        '/analytics/attendance-trends',
        queryParameters: _params(from, to, branchId),
      );
      final list = response.data!['data'] as List;
      return list
          .map((e) => TrendPoint.fromJson(e as Map<String, dynamic>))
          .toList();
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<List<TrendPoint>> newMemberGrowth({
    required DateTime from,
    required DateTime to,
    String? branchId,
  }) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        '/analytics/new-member-growth',
        queryParameters: _params(from, to, branchId),
      );
      final list = response.data!['data'] as List;
      return list
          .map((e) => TrendPoint.fromJson(e as Map<String, dynamic>))
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
