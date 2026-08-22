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
    this.restSeconds,
    this.notes,
  });

  final String exerciseId;
  final WeekDay dayOfWeek;
  final int? sets;
  final int? repetitions;
  final int? restSeconds;
  final String? notes;

  Map<String, dynamic> toJson() => {
        'exerciseId': exerciseId,
        'dayOfWeek': dayOfWeek.apiValue,
        if (sets != null) 'sets': sets,
        if (repetitions != null) 'repetitions': repetitions,
        if (restSeconds != null) 'restSeconds': restSeconds,
        if (notes != null) 'notes': notes,
      };
}

/// Full create/update field set — mirrors web's plan form
/// (`createWorkoutPlanSchema`/`updateWorkoutPlanSchema`). One input class
/// for both create (`POST`) and update (`PATCH`), same convention as
/// `MembershipPlanFormInput`: the form always submits the complete current
/// state of every field.
class WorkoutPlanFormInput {
  const WorkoutPlanFormInput({
    required this.name,
    required this.level,
    required this.durationWeeks,
    this.goal,
    this.description,
    this.trainerId,
    this.notes,
    this.isActive,
  });

  final String name;
  final WorkoutLevel level;
  final int durationWeeks;
  final String? goal;
  final String? description;
  final String? trainerId;
  final String? notes;
  final bool? isActive;

  Map<String, dynamic> toJson() => {
        'name': name,
        'level': level.apiValue,
        'durationWeeks': durationWeeks,
        if (goal != null) 'goal': goal,
        if (description != null) 'description': description,
        if (trainerId != null) 'trainerId': trainerId,
        if (notes != null) 'notes': notes,
        if (isActive != null) 'isActive': isActive,
      };
}

class WorkoutPlanRepository {
  WorkoutPlanRepository(this._dio);

  final Dio _dio;

  Future<PaginatedResult<WorkoutPlanSummary>> list({
    int page = 1,
    int limit = 20,
    String? search,
    bool? isActive,
    bool includeDeleted = false,
  }) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        '/workout-plans',
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
        WorkoutPlanSummary.fromJson,
      );
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  /// Active-only, unfiltered — for assign-plan pickers.
  Future<List<WorkoutPlanSummary>> listAssignable() async {
    try {
      final response =
          await _dio.get<Map<String, dynamic>>('/workout-plans/assignable');
      final list = response.data!['data'] as List;
      return list
          .map((e) => WorkoutPlanSummary.fromJson(e as Map<String, dynamic>))
          .toList();
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

  Future<WorkoutPlan> create(WorkoutPlanFormInput input) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        '/workout-plans',
        data: input.toJson(),
      );
      return WorkoutPlan.fromJson(
        response.data!['data'] as Map<String, dynamic>,
      );
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<WorkoutPlan> update(String planId, WorkoutPlanFormInput input) async {
    try {
      final response = await _dio.patch<Map<String, dynamic>>(
        '/workout-plans/$planId',
        data: input.toJson(),
      );
      return WorkoutPlan.fromJson(
        response.data!['data'] as Map<String, dynamic>,
      );
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<void> activate(String planId) async {
    try {
      await _dio.post<void>('/workout-plans/$planId/activate');
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<void> deactivate(String planId) async {
    try {
      await _dio.post<void>('/workout-plans/$planId/deactivate');
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  /// Soft-delete — restorable, blocks future assignment while deleted.
  Future<void> delete(String planId) async {
    try {
      await _dio.delete<void>('/workout-plans/$planId');
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<void> restore(String planId) async {
    try {
      await _dio.post<void>('/workout-plans/$planId/restore');
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  /// Creates a copy named "{name} (Copy)" including its exercises — always
  /// inactive.
  Future<WorkoutPlan> duplicate(String planId) async {
    try {
      final response = await _dio
          .post<Map<String, dynamic>>('/workout-plans/$planId/duplicate');
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
