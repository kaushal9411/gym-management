import 'package:dio/dio.dart';

import '../core/network/api_exception.dart';
import '../models/diet_plan.dart';
import '../models/diet_plan_summary.dart';
import '../models/member_diet_progress.dart';
import '../models/member_workout_progress.dart';
import '../models/paginated_result.dart';

class PlanMealDraft {
  const PlanMealDraft({required this.foodId, required this.mealType});

  final String foodId;
  final MealType mealType;

  Map<String, dynamic> toJson() => {
        'foodId': foodId,
        'mealType': mealType.apiValue,
      };
}

class DietPlanRepository {
  DietPlanRepository(this._dio);

  final Dio _dio;

  /// Read-only catalog view (Owner/Manager Menu) — unchanged from Chunk 2c.
  Future<PaginatedResult<DietPlanSummary>> list({
    int page = 1,
    int limit = 20,
  }) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        '/diet-plans',
        queryParameters: {'page': page, 'limit': limit},
      );
      return PaginatedResult.fromJson(
        response.data!['data'] as Map<String, dynamic>,
        DietPlanSummary.fromJson,
      );
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<DietPlan> getById(String planId) async {
    try {
      final response =
          await _dio.get<Map<String, dynamic>>('/diet-plans/$planId');
      return DietPlan.fromJson(response.data!['data'] as Map<String, dynamic>);
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<DietPlan> create({
    required String name,
    required int durationDays,
    int? dailyCalories,
  }) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        '/diet-plans',
        data: {
          'name': name,
          'durationDays': durationDays,
          if (dailyCalories != null) 'dailyCalories': dailyCalories,
        },
      );
      return DietPlan.fromJson(response.data!['data'] as Map<String, dynamic>);
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  /// Replaces the plan's whole meal list.
  Future<DietPlan> setMeals(String planId, List<PlanMealDraft> meals) async {
    try {
      final response = await _dio.patch<Map<String, dynamic>>(
        '/diet-plans/$planId/meals',
        data: {'meals': meals.map((m) => m.toJson()).toList()},
      );
      return DietPlan.fromJson(response.data!['data'] as Map<String, dynamic>);
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
        '/diet-plans/$planId/assign',
        data: {
          'memberId': memberId,
          'startDate': startDate.toIso8601String().substring(0, 10),
        },
      );
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<MemberDietProgress?> currentForMember(String memberId) async {
    try {
      final response =
          await _dio.get<Map<String, dynamic>>('/diet-plans/members/$memberId');
      final data = response.data!['data'] as Map<String, dynamic>;
      final current = data['current'];
      return current == null
          ? null
          : MemberDietProgress.fromJson(current as Map<String, dynamic>);
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  /// Unassigns a plan from a member — the "Remove" action on Member Detail.
  Future<void> removeAssignment(String assignmentId) async {
    try {
      await _dio.post<void>('/diet-plans/assignments/$assignmentId/remove');
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  /// Merges into the given day's log — water/weight and per-meal status all
  /// go through this one endpoint, same as web's "Save tracking" and meal
  /// Done/Skip actions.
  Future<MemberDietProgress> updateProgress({
    required String assignmentId,
    required DateTime date,
    int? waterIntakeMl,
    double? weightKg,
    Map<MealType, ExerciseProgressStatus>? mealsStatus,
  }) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        '/diet-plans/assignments/$assignmentId/progress',
        data: {
          'date': date.toIso8601String().substring(0, 10),
          if (waterIntakeMl != null) 'waterIntakeMl': waterIntakeMl,
          if (weightKg != null) 'weightKg': weightKg,
          if (mealsStatus != null)
            'mealsStatus':
                mealsStatus.map((k, v) => MapEntry(k.apiValue, v.apiValue)),
        },
      );
      return MemberDietProgress.fromJson(
        response.data!['data'] as Map<String, dynamic>,
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
