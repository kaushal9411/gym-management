import 'package:dio/dio.dart';

import '../core/network/api_exception.dart';
import '../models/paginated_result.dart';
import '../models/staff_member.dart';

class StaffRepository {
  StaffRepository(this._dio);

  final Dio _dio;

  Future<PaginatedResult<StaffMember>> list({
    int page = 1,
    String? search,
  }) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        '/staff',
        queryParameters: {
          'page': page,
          'limit': 20,
          if (search != null && search.isNotEmpty) 'search': search,
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

  Future<StaffMember> create({
    required String firstName,
    required String lastName,
    required String email,
    required StaffRole role,
    required String primaryBranchId,
  }) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        '/staff',
        data: {
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

  Future<void> softDelete(String staffId) async {
    try {
      await _dio.delete<void>('/staff/$staffId');
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
