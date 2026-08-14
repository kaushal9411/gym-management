import 'package:dio/dio.dart';

import '../core/network/api_exception.dart';
import '../models/gym_member.dart';
import '../models/paginated_result.dart';

class MemberRepository {
  MemberRepository(this._dio);

  final Dio _dio;

  Future<PaginatedResult<GymMember>> list({
    int page = 1,
    String? search,
    String? status,
    String? trainerId,
  }) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        '/members',
        queryParameters: {
          'page': page,
          'limit': 20,
          if (search != null && search.isNotEmpty) 'search': search,
          if (status != null) 'status': status,
          if (trainerId != null) 'trainerId': trainerId,
        },
      );
      return PaginatedResult.fromJson(
        response.data!['data'] as Map<String, dynamic>,
        GymMember.fromJson,
      );
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<GymMember> getById(String memberId) async {
    try {
      final response =
          await _dio.get<Map<String, dynamic>>('/members/$memberId');
      return GymMember.fromJson(
        response.data!['data'] as Map<String, dynamic>,
      );
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<GymMember> create({
    required String firstName,
    required String lastName,
    String? email,
    String? phone,
    required String branchId,
  }) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        '/members',
        data: {
          'firstName': firstName,
          'lastName': lastName,
          if (email != null && email.isNotEmpty) 'email': email,
          if (phone != null && phone.isNotEmpty) 'phone': phone,
          'branchId': branchId,
        },
      );
      return GymMember.fromJson(
        response.data!['data'] as Map<String, dynamic>,
      );
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  /// Partial `PATCH /members/:id` — pass only the fields a given edit
  /// screen owns (personal / address / health), matching how
  /// `GymSettingsRepository.saveProfile` scopes its own patches.
  Future<GymMember> update(String memberId, Map<String, dynamic> fields) async {
    try {
      final response = await _dio.patch<Map<String, dynamic>>(
        '/members/$memberId',
        data: fields,
      );
      return GymMember.fromJson(
        response.data!['data'] as Map<String, dynamic>,
      );
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<void> assignMembership(String memberId, String planId) async {
    try {
      await _dio.put<void>(
        '/members/$memberId/membership',
        data: {'planId': planId},
      );
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<void> renew(String memberId, {String? planId}) async {
    try {
      await _dio.post<void>(
        '/members/$memberId/membership/renew',
        data: {if (planId != null) 'planId': planId},
      );
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<void> upgrade(String memberId, String planId) async {
    try {
      await _dio.post<void>(
        '/members/$memberId/membership/upgrade',
        data: {'planId': planId},
      );
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<void> freeze(String memberId, {String? reason}) async {
    try {
      await _dio.post<void>(
        '/members/$memberId/freeze',
        data: {if (reason != null && reason.isNotEmpty) 'reason': reason},
      );
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<void> resume(String memberId) async {
    try {
      await _dio.post<void>('/members/$memberId/resume');
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
