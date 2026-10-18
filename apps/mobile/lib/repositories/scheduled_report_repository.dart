import 'package:dio/dio.dart';

import '../core/network/api_exception.dart';
import '../models/scheduled_report.dart';

class ScheduledReportRepository {
  ScheduledReportRepository(this._dio);

  final Dio _dio;

  Future<List<ScheduledReport>> list() async {
    try {
      final response =
          await _dio.get<Map<String, dynamic>>('/reports/scheduled');
      final list = response.data!['data'] as List;
      return list
          .map((e) => ScheduledReport.fromJson(e as Map<String, dynamic>))
          .toList();
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<ScheduledReport> create({
    required String name,
    required ScheduledReportType reportType,
    required ReportFrequency frequency,
    required List<String> recipientEmails,
  }) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        '/reports/scheduled',
        data: {
          'name': name,
          'reportType': reportType.apiValue,
          'frequency': frequency.apiValue,
          'recipientEmails': recipientEmails,
        },
      );
      return ScheduledReport.fromJson(
        response.data!['data'] as Map<String, dynamic>,
      );
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  /// Pause / resume a schedule — `PATCH /reports/scheduled/:id {isActive}`
  /// (web's Pause / Resume button; perm `reports:export`).
  Future<ScheduledReport> setActive(String id, {required bool isActive}) async {
    try {
      final response = await _dio.patch<Map<String, dynamic>>(
        '/reports/scheduled/$id',
        data: {'isActive': isActive},
      );
      return ScheduledReport.fromJson(
        response.data!['data'] as Map<String, dynamic>,
      );
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<void> runNow(String id) async {
    try {
      await _dio.post<void>('/reports/scheduled/$id/run-now');
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<void> delete(String id) async {
    try {
      await _dio.delete<void>('/reports/scheduled/$id');
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
