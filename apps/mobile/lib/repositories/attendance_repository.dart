import 'package:dio/dio.dart';

import '../core/network/api_exception.dart';
import '../models/attendance_summary.dart';
import '../models/paginated_result.dart';
import '../models/qr_validation_result.dart';

class AttendanceRepository {
  AttendanceRepository(this._dio);

  final Dio _dio;

  /// `branchId` isn't auto-scoped server-side for this endpoint (unlike
  /// `/reports/dashboard/kpis`), so callers must pass the caller's own
  /// branch explicitly to avoid leaking other branches' counts.
  Future<AttendanceSummary> summary({String? branchId}) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        '/attendance/summary',
        queryParameters: {if (branchId != null) 'branchId': branchId},
      );
      return AttendanceSummary.fromJson(
        response.data!['data'] as Map<String, dynamic>,
      );
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<List<AttendanceRecord>> today({String? branchId}) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        '/attendance/today',
        queryParameters: {if (branchId != null) 'branchId': branchId},
      );
      final list = response.data!['data'] as List;
      return list
          .map((e) => AttendanceRecord.fromJson(e as Map<String, dynamic>))
          .toList();
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  /// Looks up a member by their QR token and reports check-in eligibility
  /// without recording a visit — the token is the part after
  /// `fitcloud-member:{tenantId}:` in the scanned QR payload.
  Future<QrValidationResult> validateQr(String qrCodeToken) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        '/attendance/validate-qr',
        data: {'qrCodeToken': qrCodeToken},
      );
      return QrValidationResult.fromJson(
        response.data!['data'] as Map<String, dynamic>,
      );
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  /// `method` defaults to `QR_CODE` server-side — for a scanned check-in.
  Future<void> checkIn({required String memberId, String? branchId}) async {
    try {
      await _dio.post<void>(
        '/attendance/check-in',
        data: {
          'memberId': memberId,
          if (branchId != null) 'branchId': branchId,
        },
      );
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  /// Front-desk check-in with no QR involved — attributed to the staff
  /// member performing it (`method` forced to `MANUAL` server-side).
  Future<void> manualCheckIn({
    required String memberId,
    String? branchId,
  }) async {
    try {
      await _dio.post<void>(
        '/attendance/manual-check-in',
        data: {
          'memberId': memberId,
          if (branchId != null) 'branchId': branchId,
        },
      );
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  /// Closes out the member's open visit — `attendanceId` omitted lets the
  /// server resolve their currently-open record for today.
  Future<void> manualCheckOut({
    required String memberId,
    String? attendanceId,
  }) async {
    try {
      await _dio.post<void>(
        '/attendance/manual-check-out',
        data: {
          'memberId': memberId,
          if (attendanceId != null) 'attendanceId': attendanceId,
        },
      );
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  /// Staff-facing visit history for one member — the Member Detail
  /// screen's "Recent visits" list.
  Future<PaginatedResult<AttendanceRecord>> getMemberAttendance(
    String memberId, {
    int page = 1,
    int limit = 5,
  }) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        '/attendance/member/$memberId',
        queryParameters: {'page': page, 'limit': limit},
      );
      return PaginatedResult.fromJson(
        response.data!['data'] as Map<String, dynamic>,
        AttendanceRecord.fromJson,
      );
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  /// Tenant-wide visit history (not member-scoped) — the Attendance
  /// History screen. Mirrors web's `/attendance/history` list exactly.
  Future<PaginatedResult<AttendanceRecord>> list({
    int page = 1,
    int limit = 20,
    String? search,
    String? branchId,
    String? status,
    String? method,
    DateTime? dateFrom,
    DateTime? dateTo,
  }) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        '/attendance',
        queryParameters: {
          'page': page,
          'limit': limit,
          if (search != null && search.isNotEmpty) 'search': search,
          if (branchId != null) 'branchId': branchId,
          if (status != null) 'status': status,
          if (method != null) 'method': method,
          if (dateFrom != null)
            'dateFrom': dateFrom.toIso8601String().substring(0, 10),
          if (dateTo != null)
            'dateTo': dateTo.toIso8601String().substring(0, 10),
        },
      );
      return PaginatedResult.fromJson(
        response.data!['data'] as Map<String, dynamic>,
        AttendanceRecord.fromJson,
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
