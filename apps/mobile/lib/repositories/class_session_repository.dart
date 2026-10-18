import 'package:dio/dio.dart';

import '../core/network/api_exception.dart';
import '../models/class_session.dart';

class ClassSessionRepository {
  ClassSessionRepository(this._dio);

  final Dio _dio;

  Future<List<ClassSession>> list({
    required DateTime dateFrom,
    required DateTime dateTo,
  }) async {
    try {
      String iso(DateTime d) => d.toIso8601String().substring(0, 10);
      final response = await _dio.get<Map<String, dynamic>>(
        '/class-sessions',
        queryParameters: {'dateFrom': iso(dateFrom), 'dateTo': iso(dateTo)},
      );
      final list = response.data!['data'] as List;
      return list
          .map((e) => ClassSession.fromJson(e as Map<String, dynamic>))
          .toList();
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<ClassSessionDetail> getById(String sessionId) async {
    try {
      final response =
          await _dio.get<Map<String, dynamic>>('/class-sessions/$sessionId');
      return ClassSessionDetail.fromJson(
        response.data!['data'] as Map<String, dynamic>,
      );
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<void> book({
    required String sessionId,
    required String memberId,
  }) async {
    try {
      await _dio.post<void>(
        '/bookings',
        data: {'sessionId': sessionId, 'memberId': memberId},
      );
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<void> cancelBooking(String bookingId) async {
    try {
      await _dio.post<void>('/bookings/$bookingId/cancel');
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  /// Manually rolls the session-generation window forward
  /// (`POST /class-sessions/generate`, `classes:update`) — web's
  /// "Regenerate sessions now" button on the class detail and calendar pages;
  /// the nightly BullMQ job covers the same ground. Returns how many sessions
  /// were created (0 when nothing was missing).
  Future<int> generate({int? daysAhead}) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        '/class-sessions/generate',
        data: {if (daysAhead != null) 'daysAhead': daysAhead},
      );
      final data = response.data?['data'];
      final created = data is Map<String, dynamic> ? data['created'] : null;
      return created is num ? created.toInt() : 0;
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
