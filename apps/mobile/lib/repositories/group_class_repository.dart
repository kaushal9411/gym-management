import 'package:dio/dio.dart';

import '../core/network/api_exception.dart';
import '../models/group_class.dart';

/// `/classes` (group-class catalog) — a different resource from
/// `ClassSessionRepository`'s `/class-sessions` (the calendar's individual
/// bookable occurrences).
class GroupClassRepository {
  GroupClassRepository(this._dio);

  final Dio _dio;

  Future<GroupClass> create({
    required String name,
    required String branchId,
    String? description,
    required int capacity,
    required int durationMinutes,
  }) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        '/classes',
        data: {
          'name': name,
          'branchId': branchId,
          if (description != null && description.isNotEmpty)
            'description': description,
          'capacity': capacity,
          'durationMinutes': durationMinutes,
        },
      );
      return GroupClass.fromJson(
        response.data!['data'] as Map<String, dynamic>,
      );
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<void> setSchedule(String classId, List<ScheduleSlot> slots) async {
    try {
      await _dio.patch<void>(
        '/classes/$classId/schedule',
        data: {'slots': slots.map((s) => s.toJson()).toList()},
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
