import 'package:dio/dio.dart';

import '../core/network/api_exception.dart';
import '../models/branch.dart';
import '../models/branch_option.dart';
import '../models/paginated_result.dart';

class BranchRepository {
  BranchRepository(this._dio);

  final Dio _dio;

  /// `GET /branches`. Note `isActive` is deliberately not exposed: the API
  /// validates it with `z.coerce.boolean()`, so the string `"false"` coerces
  /// to `true` and an "inactive only" filter would silently return the active
  /// branches. Filter client-side on the full set ([listAll]) instead.
  Future<PaginatedResult<Branch>> list({
    int page = 1,
    int limit = 20,
    String? search,
    bool includeDeleted = false,
    String? sortBy,
    String? sortDir,
  }) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        '/branches',
        queryParameters: {
          'page': page,
          'limit': limit,
          if (search != null && search.isNotEmpty) 'search': search,
          // Only ever send `true` (see the coerce note above).
          if (includeDeleted) 'includeDeleted': true,
          if (sortBy != null) 'sortBy': sortBy,
          if (sortDir != null) 'sortDir': sortDir,
        },
      );
      return PaginatedResult.fromJson(
        response.data!['data'] as Map<String, dynamic>,
        Branch.fromJson,
      );
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  /// Every branch of the tenant (soft-deleted ones included by default) in
  /// one list. A tenant has a handful of branches, so the list screen loads
  /// them all and searches / filters / sorts / counts on the device — the
  /// same trade web makes for its KPI tiles. The API caps `limit` at 100, so
  /// this walks pages (at most [maxPages]).
  Future<List<Branch>> listAll({
    bool includeDeleted = true,
    int maxPages = 10,
  }) async {
    final all = <Branch>[];
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

  /// Unfiltered active-branch list — backs report/analytics branch filters
  /// (same lightweight endpoint the web app's own branch pickers use).
  Future<List<BranchOption>> assignable() async {
    try {
      final response =
          await _dio.get<Map<String, dynamic>>('/branches/assignable');
      final list = response.data!['data'] as List;
      return list
          .map((e) => BranchOption.fromJson(e as Map<String, dynamic>))
          .toList();
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<Branch> getById(String branchId) async {
    try {
      final response =
          await _dio.get<Map<String, dynamic>>('/branches/$branchId');
      return Branch.fromJson(response.data!['data'] as Map<String, dynamic>);
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  /// `POST /branches`. [body] carries any of `createBranchSchema`'s fields
  /// (name, branchCode, contact, address, GPS, timezone, operatingHours,
  /// holidays, capacity, maxMembers, maxStaff, allowCheckIn, notes).
  Future<Branch> create(Map<String, dynamic> body) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        '/branches',
        data: body,
      );
      return Branch.fromJson(response.data!['data'] as Map<String, dynamic>);
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  /// `PATCH /branches/:id` — send only the changed keys (`updateBranchSchema`
  /// treats absent keys as "leave alone"; it has no way to clear a value).
  Future<Branch> update(String branchId, Map<String, dynamic> body) async {
    try {
      final response = await _dio.patch<Map<String, dynamic>>(
        '/branches/$branchId',
        data: body,
      );
      return Branch.fromJson(response.data!['data'] as Map<String, dynamic>);
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  /// `PATCH /branches/:id` with just `operatingHours` — the whole weekly
  /// object is replaced on each save.
  Future<Branch> updateOperatingHours(
    String branchId,
    Map<String, DayHours> hours,
  ) =>
      update(branchId, {
        'operatingHours': hours.map((k, v) => MapEntry(k, v.toJson())),
      });

  /// Same endpoint, scoped to `holidays` — the whole list is replaced.
  Future<Branch> updateHolidays(
    String branchId,
    List<BranchHoliday> holidays,
  ) =>
      update(branchId, {'holidays': holidays.map((h) => h.toJson()).toList()});

  Future<void> softDelete(String branchId) async {
    try {
      await _dio.delete<void>('/branches/$branchId');
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<void> restore(String branchId) async {
    try {
      await _dio.post<void>('/branches/$branchId/restore');
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<void> setDefault(String branchId) async {
    try {
      await _dio.post<void>('/branches/$branchId/set-default');
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<void> setActive(String branchId, {required bool active}) async {
    try {
      await _dio.post<void>(
        '/branches/$branchId/${active ? 'activate' : 'deactivate'}',
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
