import 'package:dio/dio.dart';

import '../core/network/api_exception.dart';
import '../models/member_workout_progress.dart';
import '../models/paginated_result.dart';
import '../models/workout_plan.dart';
import '../models/workout_plan_summary.dart';

/// One row of a plan's weekly schedule as `PATCH /workout-plans/:id/exercises`
/// takes it. The array **replaces the whole schedule** and its order is the
/// per-day sort order, so callers always send every day's rows.
class PlanExerciseDraft {
  const PlanExerciseDraft({
    required this.exerciseId,
    required this.dayOfWeek,
    this.sets,
    this.repetitions,
    this.restSeconds,
    this.notes,
  });

  /// Carries an existing row over unchanged (sets, reps, rest AND notes —
  /// dropping the last two silently wiped them in the old editors).
  factory PlanExerciseDraft.fromPlanExercise(PlanExercise e) =>
      PlanExerciseDraft(
        exerciseId: e.exercise.id,
        dayOfWeek: e.dayOfWeek,
        sets: e.sets,
        repetitions: e.repetitions,
        restSeconds: e.restSeconds,
        notes: e.notes,
      );

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
        if (notes != null && notes!.trim().isNotEmpty) 'notes': notes!.trim(),
      };
}

/// Create fields for the minimal (Trainer) flow — mirrors the required part
/// of `createWorkoutPlanSchema`. The Owner / Manager forms build their own
/// body maps (create + diff-only edit) and use [WorkoutPlanRepository.createWith]
/// / [WorkoutPlanRepository.updateWith].
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

  /// `isActive` and `includeDeleted` are validated with `z.coerce.boolean()`,
  /// so the string `"false"` coerces to `true`: an "inactive only" query would
  /// silently return the active plans. Only `true` is ever sent; filter the
  /// rest on the device ([listAll]).
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
          if (isActive == true) 'isActive': true,
          if (includeDeleted) 'includeDeleted': true,
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

  /// Every plan of the tenant in one list (pages of 100, at most [maxPages]).
  /// A gym has a handful of plans, so the list screens load them all and
  /// search / filter / sort / count on the device — the same trade web makes
  /// for its KPI tiles, and the only safe way to filter "inactive".
  Future<List<WorkoutPlanSummary>> listAll({
    bool includeDeleted = true,
    int maxPages = 10,
  }) async {
    final all = <WorkoutPlanSummary>[];
    var page = 1;
    while (page <= maxPages) {
      final result = await list(
        page: page,
        limit: 100,
        includeDeleted: includeDeleted,
      );
      all.addAll(result.items);
      if (!result.hasNextPage) break;
      page++;
    }
    return all;
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

  /// A soft-deleted plan 404s here — open a restore sheet from the list
  /// instead.
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

  Future<WorkoutPlan> create(WorkoutPlanFormInput input) =>
      createWith(input.toJson());

  /// `POST /workout-plans` with a raw body (`createWorkoutPlanSchema`).
  Future<WorkoutPlan> createWith(Map<String, dynamic> body) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        '/workout-plans',
        data: body,
      );
      return WorkoutPlan.fromJson(
        response.data!['data'] as Map<String, dynamic>,
      );
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  /// `PATCH /workout-plans/:id` with only the keys that changed
  /// (`updateWorkoutPlanSchema`: an absent key is left alone, an empty body is
  /// rejected, `trainerId: null` clears the trainer).
  Future<WorkoutPlan> updateWith(
    String planId,
    Map<String, dynamic> body,
  ) async {
    try {
      final response = await _dio.patch<Map<String, dynamic>>(
        '/workout-plans/$planId',
        data: body,
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

  /// Assigns the plan to a member; the API completes any plan the member is
  /// currently on (history is kept).
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
          'startDate': _isoDay(startDate),
        },
      );
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  static String _isoDay(DateTime d) => '${d.year.toString().padLeft(4, '0')}-'
      '${d.month.toString().padLeft(2, '0')}-'
      '${d.day.toString().padLeft(2, '0')}';

  /// `{ current, history }` for one member.
  Future<MemberWorkoutPlans> memberPlans(String memberId) async {
    try {
      final response = await _dio
          .get<Map<String, dynamic>>('/workout-plans/members/$memberId');
      return MemberWorkoutPlans.fromJson(
        response.data!['data'] as Map<String, dynamic>,
      );
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  /// Only the `current` assignment of [memberPlans] — what the Client
  /// Progress screen and Member Detail's Workout card show.
  Future<MemberWorkoutProgress?> currentForMember(String memberId) async =>
      (await memberPlans(memberId)).current;

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
