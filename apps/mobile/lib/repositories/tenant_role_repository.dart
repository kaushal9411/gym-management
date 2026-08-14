import 'package:dio/dio.dart';

import '../core/network/api_exception.dart';
import '../models/permission_group.dart';
import '../models/tenant_role.dart';

class TenantRoleRepository {
  TenantRoleRepository(this._dio);

  final Dio _dio;

  Future<List<TenantRole>> list() async {
    try {
      final response = await _dio.get<Map<String, dynamic>>('/roles');
      final list = response.data!['data'] as List;
      return list
          .map((e) => TenantRole.fromJson(e as Map<String, dynamic>))
          .toList();
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<TenantRole> getById(String roleId) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>('/roles/$roleId');
      return TenantRole.fromJson(
        response.data!['data'] as Map<String, dynamic>,
      );
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  /// Registry backing the role form's permission-tree picker.
  Future<List<PermissionGroup>> listPermissions() async {
    try {
      final response = await _dio.get<Map<String, dynamic>>('/permissions');
      final groups = response.data!['data']['groups'] as List;
      return groups
          .map((e) => PermissionGroup.fromJson(e as Map<String, dynamic>))
          .toList();
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<TenantRole> create({
    required String name,
    String? description,
    int? priority,
    bool? isDefault,
    required List<String> permissions,
  }) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        '/roles',
        data: {
          'name': name,
          if (description != null && description.isNotEmpty)
            'description': description,
          if (priority != null) 'priority': priority,
          if (isDefault != null) 'isDefault': isDefault,
          'permissions': permissions,
        },
      );
      return TenantRole.fromJson(
        response.data!['data'] as Map<String, dynamic>,
      );
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<TenantRole> update(
    String roleId, {
    String? name,
    String? description,
    int? priority,
    bool? isDefault,
    bool? isActive,
    List<String>? permissions,
  }) async {
    try {
      final response = await _dio.patch<Map<String, dynamic>>(
        '/roles/$roleId',
        data: {
          if (name != null) 'name': name,
          if (description != null) 'description': description,
          if (priority != null) 'priority': priority,
          if (isDefault != null) 'isDefault': isDefault,
          if (isActive != null) 'isActive': isActive,
          if (permissions != null) 'permissions': permissions,
        },
      );
      return TenantRole.fromJson(
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
