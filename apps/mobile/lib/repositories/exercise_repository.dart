import 'package:dio/dio.dart';

import '../core/network/api_exception.dart';
import '../models/exercise.dart';
import '../models/paginated_result.dart';

class ExerciseRepository {
  ExerciseRepository(this._dio);

  final Dio _dio;

  Future<PaginatedResult<Exercise>> list({
    int page = 1,
    String? search,
    bool includeDeleted = false,
  }) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        '/exercises',
        queryParameters: {
          'page': page,
          'limit': 20,
          if (search != null && search.isNotEmpty) 'search': search,
          if (includeDeleted) 'includeDeleted': includeDeleted,
        },
      );
      return PaginatedResult.fromJson(
        response.data!['data'] as Map<String, dynamic>,
        Exercise.fromJson,
      );
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  /// Unfiltered active list — backs exercise pickers (day editor "+ Add
  /// exercise").
  Future<List<Exercise>> active() async {
    try {
      final response =
          await _dio.get<Map<String, dynamic>>('/exercises/active');
      final list = response.data!['data'] as List;
      return list
          .map((e) => Exercise.fromJson(e as Map<String, dynamic>))
          .toList();
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<Exercise> getById(String exerciseId) async {
    try {
      final response =
          await _dio.get<Map<String, dynamic>>('/exercises/$exerciseId');
      return Exercise.fromJson(response.data!['data'] as Map<String, dynamic>);
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<Exercise> create({
    required String name,
    String? category,
    String? muscleGroup,
    String? equipment,
    ExerciseDifficulty? difficultyLevel,
    String? instructions,
    int? defaultSets,
    int? defaultReps,
    bool? isActive,
  }) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        '/exercises',
        data: {
          'name': name,
          if (category != null) 'category': category,
          if (muscleGroup != null) 'muscleGroup': muscleGroup,
          if (equipment != null && equipment.isNotEmpty) 'equipment': equipment,
          if (difficultyLevel != null)
            'difficultyLevel': difficultyLevel.apiValue,
          if (instructions != null) 'instructions': instructions,
          if (defaultSets != null) 'defaultSets': defaultSets,
          if (defaultReps != null) 'defaultReps': defaultReps,
          if (isActive != null) 'isActive': isActive,
        },
      );
      return Exercise.fromJson(response.data!['data'] as Map<String, dynamic>);
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<Exercise> update(
    String exerciseId, {
    String? name,
    String? category,
    String? muscleGroup,
    String? equipment,
    ExerciseDifficulty? difficultyLevel,
    int? defaultSets,
    int? defaultReps,
    String? instructions,
    bool? isActive,
  }) async {
    try {
      final response = await _dio.patch<Map<String, dynamic>>(
        '/exercises/$exerciseId',
        data: {
          if (name != null) 'name': name,
          if (category != null) 'category': category,
          if (muscleGroup != null) 'muscleGroup': muscleGroup,
          if (equipment != null) 'equipment': equipment,
          if (difficultyLevel != null)
            'difficultyLevel': difficultyLevel.apiValue,
          if (defaultSets != null) 'defaultSets': defaultSets,
          if (defaultReps != null) 'defaultReps': defaultReps,
          if (instructions != null) 'instructions': instructions,
          if (isActive != null) 'isActive': isActive,
        },
      );
      return Exercise.fromJson(response.data!['data'] as Map<String, dynamic>);
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  /// Soft-delete — plans that already use it are unaffected, but it can no
  /// longer be added to new plans until restored.
  Future<void> delete(String exerciseId) async {
    try {
      await _dio.delete<void>('/exercises/$exerciseId');
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<void> restore(String exerciseId) async {
    try {
      await _dio.post<void>('/exercises/$exerciseId/restore');
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
