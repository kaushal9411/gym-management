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
  }) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        '/exercises',
        queryParameters: {
          'page': page,
          'limit': 20,
          if (search != null && search.isNotEmpty) 'search': search,
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
    int? defaultSets,
    int? defaultReps,
  }) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        '/exercises',
        data: {
          'name': name,
          if (category != null) 'category': category,
          if (muscleGroup != null) 'muscleGroup': muscleGroup,
          if (equipment != null && equipment.isNotEmpty) 'equipment': equipment,
          if (defaultSets != null) 'defaultSets': defaultSets,
          if (defaultReps != null) 'defaultReps': defaultReps,
        },
      );
      return Exercise.fromJson(response.data!['data'] as Map<String, dynamic>);
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<Exercise> update(
    String exerciseId, {
    int? defaultSets,
    int? defaultReps,
    String? instructions,
  }) async {
    try {
      final response = await _dio.patch<Map<String, dynamic>>(
        '/exercises/$exerciseId',
        data: {
          if (defaultSets != null) 'defaultSets': defaultSets,
          if (defaultReps != null) 'defaultReps': defaultReps,
          if (instructions != null) 'instructions': instructions,
        },
      );
      return Exercise.fromJson(response.data!['data'] as Map<String, dynamic>);
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
