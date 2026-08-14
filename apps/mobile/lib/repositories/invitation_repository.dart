import 'package:dio/dio.dart';

import '../core/network/api_exception.dart';
import '../models/invitation.dart';
import '../models/paginated_result.dart';

class InvitationRepository {
  InvitationRepository(this._dio);

  final Dio _dio;

  Future<PaginatedResult<Invitation>> list({
    int page = 1,
    String? status,
  }) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        '/invitations',
        queryParameters: {
          'page': page,
          'limit': 20,
          if (status != null) 'status': status,
        },
      );
      return PaginatedResult.fromJson(
        response.data!['data'] as Map<String, dynamic>,
        Invitation.fromJson,
      );
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<Invitation> invite({
    required String email,
    required String roleId,
    List<String>? branchIds,
  }) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        '/invitations',
        data: {
          'email': email,
          'roleId': roleId,
          if (branchIds != null && branchIds.isNotEmpty)
            'branchIds': branchIds,
        },
      );
      return Invitation.fromJson(
        response.data!['data'] as Map<String, dynamic>,
      );
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<Invitation> resend(String invitationId) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        '/invitations/$invitationId/resend',
      );
      return Invitation.fromJson(
        response.data!['data'] as Map<String, dynamic>,
      );
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<void> revoke(String invitationId) async {
    try {
      await _dio.delete<void>('/invitations/$invitationId');
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
