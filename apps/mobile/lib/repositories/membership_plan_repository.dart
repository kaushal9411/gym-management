import 'package:dio/dio.dart';

import '../core/network/api_exception.dart';
import '../models/membership_plan.dart';
import '../models/paginated_result.dart';

class MembershipPlanRepository {
  MembershipPlanRepository(this._dio);

  final Dio _dio;

  /// `GET /membership-plans`. `isActive` is only ever sent as `true`: the
  /// API validates it with `z.coerce.boolean()`, so the string `"false"`
  /// coerces to `true` and an "inactive only" filter would silently return
  /// the active plans (`false` is therefore ignored). Filter client-side on
  /// the full set ([listAll]) for anything else.
  Future<PaginatedResult<MembershipPlan>> list({
    int page = 1,
    int limit = 20,
    String? search,
    bool? isActive,
    bool includeDeleted = false,
    String? sortBy,
    String? sortDir,
  }) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        '/membership-plans',
        queryParameters: {
          'page': page,
          'limit': limit,
          if (search != null && search.isNotEmpty) 'search': search,
          if (isActive == true) 'isActive': true,
          // Only ever send `true` (see the coerce note above).
          if (includeDeleted) 'includeDeleted': true,
          if (sortBy != null) 'sortBy': sortBy,
          if (sortDir != null) 'sortDir': sortDir,
        },
      );
      return PaginatedResult.fromJson(
        response.data!['data'] as Map<String, dynamic>,
        MembershipPlan.fromJson,
      );
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  /// Every plan of the tenant (soft-deleted ones included by default) in one
  /// list. A gym has a handful of plans, so the list screen loads them all
  /// and searches / filters / sorts / counts on the device — the same trade
  /// web makes for its KPI tiles. The API caps `limit` at 100, so this walks
  /// pages (at most [maxPages]).
  Future<List<MembershipPlan>> listAll({
    bool includeDeleted = true,
    int maxPages = 10,
  }) async {
    final all = <MembershipPlan>[];
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

  Future<MembershipPlan> getById(String planId) async {
    try {
      final response =
          await _dio.get<Map<String, dynamic>>('/membership-plans/$planId');
      return MembershipPlan.fromJson(
        response.data!['data'] as Map<String, dynamic>,
      );
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  /// `POST /membership-plans` with a raw body (`createMembershipPlanSchema`).
  Future<MembershipPlan> create(Map<String, dynamic> body) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        '/membership-plans',
        data: body,
      );
      return MembershipPlan.fromJson(
        response.data!['data'] as Map<String, dynamic>,
      );
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  /// `PATCH /membership-plans/:id` — send only the changed keys
  /// (`updateMembershipPlanSchema` treats an absent key as "leave alone" and
  /// rejects an empty body).
  Future<MembershipPlan> update(
    String planId,
    Map<String, dynamic> body,
  ) async {
    try {
      final response = await _dio.patch<Map<String, dynamic>>(
        '/membership-plans/$planId',
        data: body,
      );
      return MembershipPlan.fromJson(
        response.data!['data'] as Map<String, dynamic>,
      );
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<void> activate(String planId) async {
    try {
      await _dio.post<void>('/membership-plans/$planId/activate');
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<void> deactivate(String planId) async {
    try {
      await _dio.post<void>('/membership-plans/$planId/deactivate');
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  /// Soft-delete — restorable, blocks future assignment while deleted.
  /// Members already on the plan are untouched.
  Future<void> delete(String planId) async {
    try {
      await _dio.delete<void>('/membership-plans/$planId');
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<void> restore(String planId) async {
    try {
      await _dio.post<void>('/membership-plans/$planId/restore');
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  /// Creates a copy named "{name} (Copy)" — always inactive.
  Future<MembershipPlan> duplicate(String planId) async {
    try {
      final response = await _dio
          .post<Map<String, dynamic>>('/membership-plans/$planId/duplicate');
      return MembershipPlan.fromJson(
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
