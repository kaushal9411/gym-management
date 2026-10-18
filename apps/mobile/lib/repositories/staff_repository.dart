import 'package:dio/dio.dart';

import '../core/network/api_exception.dart';
import '../models/paginated_result.dart';
import '../models/staff_member.dart';

/// Result of `POST /staff/bulk/{activate,deactivate,delete}`.
class StaffBulkResult {
  const StaffBulkResult({required this.succeeded, required this.failed});

  final List<String> succeeded;

  /// `userId -> reason`.
  final Map<String, String> failed;

  factory StaffBulkResult.fromJson(Map<String, dynamic> json) {
    final failed = <String, String>{};
    for (final f in (json['failed'] as List? ?? const [])) {
      if (f is Map) {
        failed['${f['userId']}'] = '${f['reason'] ?? 'Failed'}';
      }
    }
    return StaffBulkResult(
      succeeded:
          (json['succeeded'] as List? ?? const []).map((e) => '$e').toList(),
      failed: failed,
    );
  }
}

/// `POST /staff/:id/manual-activate` response — the one-time temporary
/// password the owner hands to the staff member in person.
class StaffManualActivation {
  const StaffManualActivation({
    required this.email,
    required this.temporaryPassword,
  });

  final String email;
  final String temporaryPassword;
}

class StaffRepository {
  StaffRepository(this._dio);

  final Dio _dio;

  /// `includeDeleted` is only ever sent as `true` — the API coerces with
  /// `z.coerce.boolean()`, so the string `"false"` would be truthy.
  Future<PaginatedResult<StaffMember>> list({
    int page = 1,
    int limit = 20,
    String? search,
    StaffRole? role,
    String? status,
    String? workStatus,
    String? employmentType,
    String? branchId,
    bool includeDeleted = false,
    String sortBy = 'createdAt',
    String sortDir = 'desc',
  }) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        '/staff',
        queryParameters: {
          'page': page,
          'limit': limit,
          if (search != null && search.isNotEmpty) 'search': search,
          if (role != null) 'role': role.apiValue,
          if (status != null) 'status': status,
          if (workStatus != null) 'workStatus': workStatus,
          if (employmentType != null) 'employmentType': employmentType,
          if (branchId != null) 'branchId': branchId,
          if (includeDeleted) 'includeDeleted': true,
          'sortBy': sortBy,
          'sortDir': sortDir,
        },
      );
      return PaginatedResult.fromJson(
        response.data!['data'] as Map<String, dynamic>,
        StaffMember.fromJson,
      );
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  /// Walks every page (100 per request, capped) — backs the roster KPI tiles
  /// and insight panels, which need the whole team, not one page.
  Future<List<StaffMember>> listAll({
    String? branchId,
    bool includeDeleted = true,
    int maxPages = 10,
  }) async {
    final out = <StaffMember>[];
    var page = 1;
    while (page <= maxPages) {
      final result = await list(
        page: page,
        limit: 100,
        branchId: branchId,
        includeDeleted: includeDeleted,
      );
      out.addAll(result.items);
      if (!result.hasNextPage) break;
      page++;
    }
    return out;
  }

  Future<StaffMember> getById(String staffId) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>('/staff/$staffId');
      return StaffMember.fromJson(
        response.data!['data'] as Map<String, dynamic>,
      );
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  /// `POST /staff`. [extra] carries the optional `createStaffSchema` keys
  /// (phone, employeeId, branchIds, gender, dateOfBirth, joiningDate,
  /// address, emergency contact, notes, employment fields) — only the
  /// non-empty ones should be passed.
  Future<StaffMember> create({
    required String firstName,
    required String lastName,
    required String email,
    required StaffRole role,
    required String primaryBranchId,
    Map<String, dynamic> extra = const {},
  }) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        '/staff',
        data: {
          ...extra,
          'firstName': firstName,
          'lastName': lastName,
          'email': email,
          'role': role.apiValue,
          'primaryBranchId': primaryBranchId,
        },
      );
      return StaffMember.fromJson(
        response.data!['data'] as Map<String, dynamic>,
      );
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  /// Partial `PATCH /staff/:id` — same scoped-fields pattern as
  /// `MemberRepository.update`.
  Future<StaffMember> update(
    String staffId,
    Map<String, dynamic> fields,
  ) async {
    try {
      final response = await _dio.patch<Map<String, dynamic>>(
        '/staff/$staffId',
        data: fields,
      );
      return StaffMember.fromJson(
        response.data!['data'] as Map<String, dynamic>,
      );
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<void> assignRole(String staffId, StaffRole role) async {
    try {
      await _dio.put<void>(
        '/staff/$staffId/role',
        data: {'role': role.apiValue},
      );
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  /// `PUT /staff/:id/branches` — replaces the whole set; [branchIds] must be
  /// non-empty and contain [primaryBranchId].
  Future<StaffMember> assignBranches(
    String staffId, {
    required String primaryBranchId,
    required List<String> branchIds,
  }) async {
    try {
      final response = await _dio.put<Map<String, dynamic>>(
        '/staff/$staffId/branches',
        data: {'primaryBranchId': primaryBranchId, 'branchIds': branchIds},
      );
      return StaffMember.fromJson(
        response.data!['data'] as Map<String, dynamic>,
      );
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<void> softDelete(String staffId) => _post(null, staffId, delete: true);

  Future<void> activate(String staffId) => _post('activate', staffId);
  Future<void> deactivate(String staffId) => _post('deactivate', staffId);
  Future<void> suspend(String staffId) => _post('suspend', staffId);
  Future<void> restore(String staffId) => _post('restore', staffId);
  Future<void> resetPassword(String staffId) =>
      _post('reset-password', staffId);
  Future<void> resendActivation(String staffId) =>
      _post('resend-activation', staffId);

  Future<StaffManualActivation> manualActivate(String staffId) async {
    try {
      final response = await _dio
          .post<Map<String, dynamic>>('/staff/$staffId/manual-activate');
      final data = response.data!['data'] as Map<String, dynamic>;
      return StaffManualActivation(
        email: data['email']?.toString() ?? '',
        temporaryPassword: data['temporaryPassword']?.toString() ?? '',
      );
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  /// `action` is `activate` | `deactivate` | `delete`.
  Future<StaffBulkResult> bulk(String action, List<String> userIds) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        '/staff/bulk/$action',
        data: {'userIds': userIds},
      );
      return StaffBulkResult.fromJson(
        response.data!['data'] as Map<String, dynamic>,
      );
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<void> _post(
    String? action,
    String staffId, {
    bool delete = false,
  }) async {
    try {
      if (delete) {
        await _dio.delete<void>('/staff/$staffId');
      } else {
        await _dio.post<void>('/staff/$staffId/$action');
      }
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
