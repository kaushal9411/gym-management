import 'package:dio/dio.dart';

import '../core/network/api_exception.dart';
import '../models/iam_user.dart';
import '../models/paginated_result.dart';

class BranchAssignmentDraft {
  const BranchAssignmentDraft({
    required this.branchId,
    this.isPrimary,
    this.expiresAt,
  });

  final String branchId;
  final bool? isPrimary;
  final DateTime? expiresAt;

  Map<String, dynamic> toJson() => {
        'branchId': branchId,
        if (isPrimary != null) 'isPrimary': isPrimary,
        if (expiresAt != null) 'expiresAt': expiresAt!.toIso8601String(),
      };
}

/// `/users` — the identity/access-control plane (roles, branch access,
/// permission overrides, login history), distinct from `/staff`'s
/// employment-profile plane. See [IamUser]'s doc comment.
class IamUserRepository {
  IamUserRepository(this._dio);

  final Dio _dio;

  Future<PaginatedResult<IamUser>> list({
    int page = 1,
    String? search,
    String? status,
    String? roleId,
  }) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        '/users',
        queryParameters: {
          'page': page,
          'limit': 20,
          if (search != null && search.isNotEmpty) 'search': search,
          if (status != null) 'status': status,
          if (roleId != null) 'roleId': roleId,
        },
      );
      return PaginatedResult.fromJson(
        response.data!['data'] as Map<String, dynamic>,
        IamUser.fromJson,
      );
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<IamUser> getById(String userId) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>('/users/$userId');
      return IamUser.fromJson(response.data!['data'] as Map<String, dynamic>);
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<IamUser> create({
    required String name,
    required String email,
    required String password,
    String? phone,
    required List<String> roleIds,
    bool allBranches = false,
    List<BranchAssignmentDraft> branches = const [],
  }) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        '/users',
        data: {
          'name': name,
          'email': email,
          'password': password,
          if (phone != null && phone.isNotEmpty) 'phone': phone,
          'roleIds': roleIds,
          if (allBranches) 'allBranches': true,
          if (branches.isNotEmpty)
            'branches': branches.map((b) => b.toJson()).toList(),
        },
      );
      return IamUser.fromJson(response.data!['data'] as Map<String, dynamic>);
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  /// Suspend/deactivate/restore all respond with `data: null` — verified
  /// live, the same shape as `POST /payments/:id/cancel` — so there's
  /// nothing to parse; callers re-fetch to see the new status.
  Future<void> suspend(String userId) async {
    try {
      await _dio.post<void>('/users/$userId/suspend');
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<void> deactivate(String userId) async {
    try {
      await _dio.post<void>('/users/$userId/deactivate');
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<void> restore(String userId) async {
    try {
      await _dio.post<void>('/users/$userId/restore');
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<void> delete(String userId) async {
    try {
      await _dio.delete<void>('/users/$userId');
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  /// Replaces the user's entire role set.
  Future<IamUser> setRoles(String userId, List<String> roleIds) async {
    try {
      final response = await _dio.put<Map<String, dynamic>>(
        '/users/$userId/roles',
        data: {'roleIds': roleIds},
      );
      return IamUser.fromJson(response.data!['data'] as Map<String, dynamic>);
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  /// Replaces the user's entire branch access.
  Future<IamUser> setBranches(
    String userId, {
    required bool allBranches,
    List<BranchAssignmentDraft> branches = const [],
  }) async {
    try {
      final response = await _dio.put<Map<String, dynamic>>(
        '/users/$userId/branches',
        data: {
          'allBranches': allBranches,
          'branches': branches.map((b) => b.toJson()).toList(),
        },
      );
      return IamUser.fromJson(response.data!['data'] as Map<String, dynamic>);
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  /// Replaces the user's entire permission-override set.
  Future<IamUser> setPermissionOverrides(
    String userId,
    List<PermissionOverride> overrides,
  ) async {
    try {
      final response = await _dio.put<Map<String, dynamic>>(
        '/users/$userId/permissions',
        data: {'overrides': overrides.map((o) => o.toJson()).toList()},
      );
      return IamUser.fromJson(response.data!['data'] as Map<String, dynamic>);
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
