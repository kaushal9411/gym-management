import 'package:dio/dio.dart';

import '../core/network/api_exception.dart';
import '../models/body_measurement.dart';

/// Staff-side (Owner/Manager/Trainer) CRUD against a specific member's body
/// measurement history — `/measurements/*`, RBAC-gated server-side
/// (`measurements:view/create/update/delete`). The member's own read-only
/// self-view lives on `MemberPortalRepository#measurements` instead
/// (`/portal/measurements`, no memberId — the member plane scopes to
/// `req.memberAuth.sub` itself).
class BodyMeasurementRepository {
  BodyMeasurementRepository(this._dio);

  final Dio _dio;

  /// Only members with at least one entry — not the full member roster.
  Future<List<MeasuredMemberOption>> listMembers() async {
    try {
      final response =
          await _dio.get<Map<String, dynamic>>('/measurements/members');
      final data = response.data!['data'] as List<dynamic>;
      return data
          .map(
            (e) => MeasuredMemberOption.fromJson(e as Map<String, dynamic>),
          )
          .toList();
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<List<BodyMeasurement>> listForMember(String memberId) async {
    try {
      final response = await _dio
          .get<Map<String, dynamic>>('/measurements/members/$memberId');
      final data = response.data!['data'] as List<dynamic>;
      return data
          .map((e) => BodyMeasurement.fromJson(e as Map<String, dynamic>))
          .toList();
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<BodyMeasurement> create(
    String memberId,
    BodyMeasurementFormInput input,
  ) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        '/measurements/members/$memberId',
        data: input.toJson(),
      );
      return BodyMeasurement.fromJson(
        response.data!['data'] as Map<String, dynamic>,
      );
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<BodyMeasurement> update(
    String id,
    BodyMeasurementFormInput input,
  ) async {
    try {
      final response = await _dio.patch<Map<String, dynamic>>(
        '/measurements/$id',
        data: input.toJson(),
      );
      return BodyMeasurement.fromJson(
        response.data!['data'] as Map<String, dynamic>,
      );
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<void> delete(String id) async {
    try {
      await _dio.delete<void>('/measurements/$id');
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
