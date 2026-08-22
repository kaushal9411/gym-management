import 'package:dio/dio.dart';

import '../core/network/api_exception.dart';
import '../models/group_class.dart';
import '../models/paginated_result.dart';

/// `/classes` (group-class catalog) — a different resource from
/// `ClassSessionRepository`'s `/class-sessions` (the calendar's individual
/// bookable occurrences).
class GroupClassRepository {
  GroupClassRepository(this._dio);

  final Dio _dio;

  Future<PaginatedResult<GroupClass>> list({
    int page = 1,
    int limit = 20,
    String? search,
    bool? isActive,
    bool includeDeleted = false,
  }) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        '/classes',
        queryParameters: {
          'page': page,
          'limit': limit,
          if (search != null && search.isNotEmpty) 'search': search,
          if (isActive != null) 'isActive': isActive,
          if (includeDeleted) 'includeDeleted': includeDeleted,
        },
      );
      return PaginatedResult.fromJson(
        response.data!['data'] as Map<String, dynamic>,
        GroupClass.fromJson,
      );
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  /// Active-only, unfiltered — for assign/booking pickers.
  Future<List<GroupClass>> listAssignable() async {
    try {
      final response =
          await _dio.get<Map<String, dynamic>>('/classes/assignable');
      final list = response.data!['data'] as List;
      return list
          .map((e) => GroupClass.fromJson(e as Map<String, dynamic>))
          .toList();
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<GroupClass> getById(String classId) async {
    try {
      final response =
          await _dio.get<Map<String, dynamic>>('/classes/$classId');
      return GroupClass.fromJson(
        response.data!['data'] as Map<String, dynamic>,
      );
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<GroupClass> create({
    required String name,
    required String branchId,
    String? description,
    String? trainerId,
    required int capacity,
    required int durationMinutes,
    bool? isActive,
  }) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        '/classes',
        data: {
          'name': name,
          'branchId': branchId,
          if (description != null && description.isNotEmpty)
            'description': description,
          if (trainerId != null) 'trainerId': trainerId,
          'capacity': capacity,
          'durationMinutes': durationMinutes,
          if (isActive != null) 'isActive': isActive,
        },
      );
      return GroupClass.fromJson(
        response.data!['data'] as Map<String, dynamic>,
      );
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<GroupClass> update(
    String classId, {
    String? name,
    String? description,
    String? trainerId,
    String? branchId,
    int? capacity,
    int? durationMinutes,
    bool? isActive,
  }) async {
    try {
      final response = await _dio.patch<Map<String, dynamic>>(
        '/classes/$classId',
        data: {
          if (name != null) 'name': name,
          if (description != null) 'description': description,
          'trainerId': trainerId,
          if (branchId != null) 'branchId': branchId,
          if (capacity != null) 'capacity': capacity,
          if (durationMinutes != null) 'durationMinutes': durationMinutes,
          if (isActive != null) 'isActive': isActive,
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

  /// Soft-delete — restorable, blocks future scheduling while deleted.
  Future<void> delete(String classId) async {
    try {
      await _dio.delete<void>('/classes/$classId');
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<void> restore(String classId) async {
    try {
      await _dio.post<void>('/classes/$classId/restore');
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
