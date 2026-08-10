import 'package:dio/dio.dart';

import '../core/network/api_exception.dart';
import '../models/active_vs_inactive_row.dart';
import '../models/branch_performance_row.dart';
import '../models/trainer_performance_row.dart';

class ReportsRepository {
  ReportsRepository(this._dio);

  final Dio _dio;

  Future<List<BranchPerformanceRow>> branchPerformance() async {
    try {
      final response =
          await _dio.get<Map<String, dynamic>>('/reports/branch-performance');
      final list = response.data!['data'] as List;
      return list
          .map((e) => BranchPerformanceRow.fromJson(e as Map<String, dynamic>))
          .toList();
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  /// Aggregates payment method totals from the (up to 200 most recent)
  /// revenue rows in range — not a dedicated backend aggregation endpoint,
  /// so very high-volume tenants would see a "recent sample" rather than a
  /// true full-period total. Good enough for the Analytics donut's shape.
  Future<Map<String, double>> revenueByMethod({
    required DateTime from,
    required DateTime to,
    String? branchId,
  }) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        '/reports/revenue',
        queryParameters: {
          'dateFrom': from.toIso8601String().substring(0, 10),
          'dateTo': to.toIso8601String().substring(0, 10),
          'limit': 200,
          if (branchId != null) 'branchId': branchId,
        },
      );
      final data = response.data!['data'] as Map<String, dynamic>;
      final items = data['items'] as List;
      final totals = <String, double>{};
      for (final row in items) {
        final method = (row as Map<String, dynamic>)['method'] as String;
        final amount = double.parse(row['amount'] as String);
        totals[method] = (totals[method] ?? 0) + amount;
      }
      return totals;
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<List<TrainerPerformanceRow>> trainerPerformance({
    String? branchId,
  }) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        '/reports/trainer-performance',
        queryParameters: {if (branchId != null) 'branchId': branchId},
      );
      final list = response.data!['data'] as List;
      return list
          .map((e) => TrainerPerformanceRow.fromJson(e as Map<String, dynamic>))
          .toList();
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<List<ActiveVsInactiveRow>> activeVsInactive({String? branchId}) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        '/reports/active-vs-inactive',
        queryParameters: {if (branchId != null) 'branchId': branchId},
      );
      final list = response.data!['data'] as List;
      return list
          .map((e) => ActiveVsInactiveRow.fromJson(e as Map<String, dynamic>))
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
