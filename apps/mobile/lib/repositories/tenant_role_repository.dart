import 'package:dio/dio.dart';

import '../core/network/api_exception.dart';
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
