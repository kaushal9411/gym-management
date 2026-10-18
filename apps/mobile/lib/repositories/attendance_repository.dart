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
  ///
  /// `dateFrom`/`dateTo` (YYYY-MM-DD) only widen the `trend` series (default
  /// last 7 days); today's live figures are always today's.
  Future<AttendanceSummary> summary({
    String? branchId,
    DateTime? dateFrom,
    DateTime? dateTo,
  }) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        '/attendance/summary',
        queryParameters: {
          if (branchId != null) 'branchId': branchId,
          if (dateFrom != null) 'dateFrom': _ymd(dateFrom),
          if (dateTo != null) 'dateTo': _ymd(dateTo),
        },
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

  /// Checks a member out (QR flow) — `POST /attendance/check-out`, needs
  /// `attendance:checkout`. Pass `memberId` (server finds the open visit) or
  /// `attendanceId`.
  Future<void> checkOut({String? memberId, String? attendanceId}) async {
    try {
      await _dio.post<void>(
        '/attendance/check-out',
        data: {
          if (memberId != null) 'memberId': memberId,
          if (attendanceId != null) 'attendanceId': attendanceId,
        },
      );
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  /// Corrects a record (`PATCH /attendance/:id`, `attendance:update`). Only
  /// the keys present in [body] are sent: `checkOutTime` (ISO-8601 UTC or an
  /// explicit null to reopen the visit), `notes`, `status`.
  Future<void> update(String id, Map<String, dynamic> body) async {
    try {
      await _dio.patch<void>('/attendance/$id', data: body);
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  /// Soft-deletes a record (`DELETE /attendance/:id`, `attendance:delete`).
  Future<void> delete(String id) async {
    try {
      await _dio.delete<void>('/attendance/$id');
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
    String sortBy = 'checkInTime',
    String sortDir = 'desc',
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
          if (dateFrom != null) 'dateFrom': _ymd(dateFrom),
          if (dateTo != null) 'dateTo': _ymd(dateTo),
          'sortBy': sortBy,
          'sortDir': sortDir,
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

  static String _ymd(DateTime d) => '${d.year.toString().padLeft(4, '0')}-'
      '${d.month.toString().padLeft(2, '0')}-'
      '${d.day.toString().padLeft(2, '0')}';

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
