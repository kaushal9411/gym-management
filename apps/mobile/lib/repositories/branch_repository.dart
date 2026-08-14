import 'package:dio/dio.dart';

import '../core/network/api_exception.dart';
import '../models/branch.dart';
import '../models/branch_option.dart';
import '../models/paginated_result.dart';

/// Fields the mobile "Add/Edit Branch" form actually collects — a subset of
/// `CreateBranchInput`/`UpdateBranchInput` (both allow much more: operating
/// hours, holidays, GPS, etc., none of which the design's branch form asks for).
class BranchFormInput {
  const BranchFormInput({required this.name, this.addressLine1, this.capacity});

  final String name;
  final String? addressLine1;
  final int? capacity;

  Map<String, dynamic> toJson() => {
        'name': name,
        if (addressLine1 != null && addressLine1!.isNotEmpty)
          'addressLine1': addressLine1,
        if (capacity != null) 'capacity': capacity,
      };
}

class BranchRepository {
  BranchRepository(this._dio);

  final Dio _dio;

  Future<PaginatedResult<Branch>> list({
    int page = 1,
    int limit = 20,
    String? search,
  }) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        '/branches',
        queryParameters: {
          'page': page,
          'limit': limit,
          if (search != null && search.isNotEmpty) 'search': search,
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

  Future<Branch> create(BranchFormInput input) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        '/branches',
        data: input.toJson(),
      );
      return Branch.fromJson(response.data!['data'] as Map<String, dynamic>);
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<Branch> update(String branchId, BranchFormInput input) async {
    try {
      final response = await _dio.patch<Map<String, dynamic>>(
        '/branches/$branchId',
        data: input.toJson(),
      );
      return Branch.fromJson(response.data!['data'] as Map<String, dynamic>);
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  /// `PATCH /branches/:id` with just `operatingHours` — same endpoint the
  /// name/address form uses, scoped to one field (frame "8c. Operating hours").
  Future<Branch> updateOperatingHours(
    String branchId,
    Map<String, DayHours> hours,
  ) async {
    try {
      final response = await _dio.patch<Map<String, dynamic>>(
        '/branches/$branchId',
        data: {'operatingHours': hours.map((k, v) => MapEntry(k, v.toJson()))},
      );
      return Branch.fromJson(response.data!['data'] as Map<String, dynamic>);
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  /// Same endpoint, scoped to `holidays` (frame "8d. Holidays") — the whole
  /// list is replaced on each save, matching `operatingHours`'s shape.
  Future<Branch> updateHolidays(
    String branchId,
    List<BranchHoliday> holidays,
  ) async {
    try {
      final response = await _dio.patch<Map<String, dynamic>>(
        '/branches/$branchId',
        data: {'holidays': holidays.map((h) => h.toJson()).toList()},
      );
      return Branch.fromJson(response.data!['data'] as Map<String, dynamic>);
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<void> softDelete(String branchId) async {
    try {
      await _dio.delete<void>('/branches/$branchId');
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
