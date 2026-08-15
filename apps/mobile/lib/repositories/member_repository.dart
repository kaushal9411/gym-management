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
    String? memberId,
    required String branchId,
    String? trainerId,
    String? fitnessGoals,
  }) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        '/members',
        data: {
          'firstName': firstName,
          'lastName': lastName,
          if (email != null && email.isNotEmpty) 'email': email,
          if (phone != null && phone.isNotEmpty) 'phone': phone,
          if (memberId != null && memberId.isNotEmpty) 'memberId': memberId,
          'branchId': branchId,
          if (trainerId != null) 'trainerId': trainerId,
          if (fitnessGoals != null && fitnessGoals.isNotEmpty)
            'fitnessGoals': fitnessGoals,
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

  Future<void> downgrade(String memberId, String planId) async {
    try {
      await _dio.post<void>(
        '/members/$memberId/membership/downgrade',
        data: {'planId': planId},
      );
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<void> extend(String memberId, int days, {String? reason}) async {
    try {
      await _dio.post<void>(
        '/members/$memberId/membership/extend',
        data: {
          'days': days,
          if (reason != null && reason.isNotEmpty) 'reason': reason,
        },
      );
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<void> cancelMembership(String memberId, {String? reason}) async {
    try {
      await _dio.post<void>(
        '/members/$memberId/membership/cancel',
        data: {if (reason != null && reason.isNotEmpty) 'reason': reason},
      );
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<void> transferBranch(String memberId, String branchId) async {
    try {
      await _dio.put<void>(
        '/members/$memberId/branch',
        data: {'branchId': branchId},
      );
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  /// `trainerId: null` unassigns the trainer — the endpoint distinguishes
  /// "field omitted" from "field explicitly null", so this always sends
  /// the key.
  Future<void> assignTrainer(String memberId, String? trainerId) async {
    try {
      await _dio.put<void>(
        '/members/$memberId/trainer',
        data: {'trainerId': trainerId},
      );
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<void> activate(String memberId) async {
    try {
      await _dio.post<void>('/members/$memberId/activate');
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<void> deactivate(String memberId) async {
    try {
      await _dio.post<void>('/members/$memberId/deactivate');
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<void> softDelete(String memberId) async {
    try {
      await _dio.delete<void>('/members/$memberId');
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<void> restore(String memberId) async {
    try {
      await _dio.post<void>('/members/$memberId/restore');
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  /// Returns the new `{qrCodeToken, qrCodeImageUrl}` — callers should
  /// re-fetch the full member (or splice these two fields in) to refresh
  /// the displayed code.
  Future<Map<String, dynamic>> regenerateQrCode(String memberId) async {
    try {
      final response =
          await _dio.post<Map<String, dynamic>>('/members/$memberId/qr-code');
      return response.data!['data'] as Map<String, dynamic>;
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  /// Emails the member an activation link for self-service portal login —
  /// the member needs an email on file first (the endpoint 422s otherwise).
  Future<void> sendPortalInvite(String memberId) async {
    try {
      await _dio.post<void>('/members/$memberId/portal-invite');
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  /// GDPR data-portability export — the full bundle (profile, attendance,
  /// plans, invoices, payments, documents, bookings) as raw JSON. Staff-
  /// triggered, for any member; distinct from the member portal's own
  /// `/portal/gdpr-export` self-service endpoint.
  Future<Map<String, dynamic>> gdprExport(String memberId) async {
    try {
      final response = await _dio
          .get<Map<String, dynamic>>('/members/$memberId/gdpr-export');
      return response.data!['data'] as Map<String, dynamic>;
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  /// GDPR right-to-erasure — anonymizes profile/contact/medical fields,
  /// revokes portal access, deletes documents. Irreversible.
  Future<void> gdprErase(String memberId) async {
    try {
      await _dio.post<void>('/members/$memberId/gdpr-erase');
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
