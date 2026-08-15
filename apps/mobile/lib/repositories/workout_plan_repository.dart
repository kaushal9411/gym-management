import 'package:dio/dio.dart';

import '../core/network/api_exception.dart';
import '../models/member_workout_progress.dart';
import '../models/paginated_result.dart';
import '../models/workout_plan.dart';
import '../models/workout_plan_summary.dart';

class PlanExerciseDraft {
  const PlanExerciseDraft({
    required this.exerciseId,
    required this.dayOfWeek,
    this.sets,
    this.repetitions,
  });

  final String exerciseId;
  final WeekDay dayOfWeek;
  final int? sets;
  final int? repetitions;

  Map<String, dynamic> toJson() => {
        'exerciseId': exerciseId,
        'dayOfWeek': dayOfWeek.apiValue,
        if (sets != null) 'sets': sets,
        if (repetitions != null) 'repetitions': repetitions,
      };
}

class WorkoutPlanRepository {
  WorkoutPlanRepository(this._dio);

  final Dio _dio;

  /// Read-only catalog view (Owner/Manager Menu) — unchanged from Chunk 2c.
  Future<PaginatedResult<WorkoutPlanSummary>> list({
    int page = 1,
    int limit = 20,
  }) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        '/workout-plans',
        queryParameters: {'page': page, 'limit': limit},
      );
      return PaginatedResult.fromJson(
        response.data!['data'] as Map<String, dynamic>,
        WorkoutPlanSummary.fromJson,
      );
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<WorkoutPlan> getById(String planId) async {
    try {
      final response =
          await _dio.get<Map<String, dynamic>>('/workout-plans/$planId');
      return WorkoutPlan.fromJson(
        response.data!['data'] as Map<String, dynamic>,
      );
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<WorkoutPlan> create({
    required String name,
    required WorkoutLevel level,
    required int durationWeeks,
  }) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        '/workout-plans',
        data: {
          'name': name,
          'level': level.apiValue,
          'durationWeeks': durationWeeks,
        },
      );
      return WorkoutPlan.fromJson(
        response.data!['data'] as Map<String, dynamic>,
      );
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  /// Replaces the plan's whole weekly schedule.
  Future<WorkoutPlan> setExercises(
    String planId,
    List<PlanExerciseDraft> exercises,
  ) async {
    try {
      final response = await _dio.patch<Map<String, dynamic>>(
        '/workout-plans/$planId/exercises',
        data: {'exercises': exercises.map((e) => e.toJson()).toList()},
      );
      return WorkoutPlan.fromJson(
        response.data!['data'] as Map<String, dynamic>,
      );
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<void> assign({
    required String planId,
    required String memberId,
    required DateTime startDate,
  }) async {
    try {
      await _dio.post<void>(
        '/workout-plans/$planId/assign',
        data: {
          'memberId': memberId,
          'startDate': startDate.toIso8601String().substring(0, 10),
        },
      );
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  /// `{ current, history }` — only `current` is modeled, matching what the
  /// Client Progress screen shows.
  Future<MemberWorkoutProgress?> currentForMember(String memberId) async {
    try {
      final response = await _dio
          .get<Map<String, dynamic>>('/workout-plans/members/$memberId');
      final data = response.data!['data'] as Map<String, dynamic>;
      final current = data['current'];
      return current == null
          ? null
          : MemberWorkoutProgress.fromJson(current as Map<String, dynamic>);
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<void> updateTrainerRemarks({
    required String assignmentId,
    required String trainerRemarks,
  }) async {
    try {
      await _dio.patch<void>(
        '/workout-plans/assignments/$assignmentId',
        data: {'trainerRemarks': trainerRemarks},
      );
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  /// Unassigns a plan from a member — the "Remove" action on Member Detail.
  Future<void> removeAssignment(String assignmentId) async {
    try {
      await _dio.post<void>('/workout-plans/assignments/$assignmentId/remove');
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<void> markProgress({
    required String assignmentId,
    required String exerciseId,
    required ExerciseProgressStatus status,
  }) async {
    try {
      await _dio.post<void>(
        '/workout-plans/assignments/$assignmentId/progress',
        data: {'exerciseId': exerciseId, 'status': status.apiValue},
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
