import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';

import '../core/network/api_exception.dart';
import '../models/hr_admin.dart';
import '../models/hr_attendance.dart';
import '../models/hr_enums.dart';
import '../models/hr_leave.dart';
import '../models/hr_payroll.dart';
import '../models/hr_summary.dart';
import '../models/paginated_result.dart';
import '../models/report_export.dart';

/// Everything under `/hr/*` (`docs/HR-API-CONTRACT.md`). Two halves that map
/// onto two permission families:
///
/// * **Self-service** (`/hr/me/*`, keys `hr:self_*`) - always the caller's own
///   data. A staff user without a StaffProfile (today: the OWNER) gets
///   403 `NOT_AN_EMPLOYEE`, see [isNotAnEmployee].
/// * **HR admin** (`hr:view` / `hr:attendance_manage` / `hr:leave_manage` /
///   `hr:payroll_manage`) - overview, team attendance, approvals, employees and
///   payroll payments.
///
/// Money is a JSON number here (not a Decimal string), days are numbers with
/// at most one decimal, dates are `YYYY-MM-DD` IST business dates.
class HrRepository {
  HrRepository(this._dio);

  final Dio _dio;

  /// `true` for the 403 every `/hr/me/*` route returns for a user without a
  /// StaffProfile.
  static bool isNotAnEmployee(Object e) =>
      e is ApiException && e.statusCode == 403 && e.code == 'NOT_AN_EMPLOYEE';

  // ── self: attendance ──────────────────────────────────────────────────────

  Future<HrMeSummary> meSummary() => _run(() async {
        final r = await _dio.get<Map<String, dynamic>>('/hr/me/summary');
        return HrMeSummary.fromJson(_data(r));
      });

  /// 201 with today's `AttendanceDay`. 409 `ALREADY_CHECKED_IN` /
  /// `INVALID_STATE` (on leave / already marked by HR).
  Future<HrAttendanceDay> checkIn({String? note}) => _run(() async {
        final r = await _dio.post<Map<String, dynamic>>(
          '/hr/me/attendance/check-in',
          data: {
            if (note != null && note.trim().isNotEmpty) 'note': note.trim(),
          },
        );
        return HrAttendanceDay.fromJson(_data(r));
      });

  /// 409 `NOT_CHECKED_IN` / `ALREADY_CHECKED_OUT`.
  Future<HrAttendanceDay> checkOut() => _run(() async {
        final r = await _dio.post<Map<String, dynamic>>(
          '/hr/me/attendance/check-out',
          data: <String, dynamic>{},
        );
        return HrAttendanceDay.fromJson(_data(r));
      });

  /// [month] = `YYYY-MM` (default: the current IST month; never after it).
  Future<HrMonthAttendance> myAttendance({String? month}) => _run(() async {
        final r = await _dio.get<Map<String, dynamic>>(
          '/hr/me/attendance',
          queryParameters: {if (month != null) 'month': month},
        );
        return HrMonthAttendance.fromJson(_data(r));
      });

  // ── self: leave ───────────────────────────────────────────────────────────

  Future<List<HrLeaveType>> myLeaveTypes() => _run(() async {
        final r = await _dio.get<Map<String, dynamic>>('/hr/me/leave-types');
        return _list(r, HrLeaveType.fromJson);
      });

  Future<List<HrLeaveBalance>> myLeaveBalances({int? leaveYear}) =>
      _run(() async {
        final r = await _dio.get<Map<String, dynamic>>(
          '/hr/me/leave-balances',
          queryParameters: {if (leaveYear != null) 'leaveYear': leaveYear},
        );
        return (_data(r)['balances'] as List? ?? const [])
            .whereType<Map<String, dynamic>>()
            .map(HrLeaveBalance.fromJson)
            .toList();
      });

  Future<List<HrHoliday>> myHolidays({int? year}) => _run(() async {
        final r = await _dio.get<Map<String, dynamic>>(
          '/hr/me/holidays',
          queryParameters: {if (year != null) 'year': year},
        );
        return _list(r, HrHoliday.fromJson);
      });

  /// Same validation as apply, writes nothing.
  Future<HrLeavePreview> previewMyLeave({
    required String leaveTypeId,
    required DateTime startDate,
    required DateTime endDate,
    required DayPart dayPart,
  }) =>
      _run(() async {
        final r = await _dio.post<Map<String, dynamic>>(
          '/hr/me/leaves/preview',
          data: _leaveBody(leaveTypeId, startDate, endDate, dayPart),
        );
        return HrLeavePreview.fromJson(_data(r));
      });

  Future<PaginatedResult<HrLeaveRequest>> myLeaves({
    int page = 1,
    int limit = 20,
    LeaveStatus? status,
  }) =>
      _run(() async {
        final r = await _dio.get<Map<String, dynamic>>(
          '/hr/me/leaves',
          queryParameters: {
            'page': page,
            'limit': limit,
            if (status != null) 'status': status.api,
          },
        );
        return PaginatedResult.fromJson(_data(r), HrLeaveRequest.fromJson);
      });

  Future<HrLeaveRequest> myLeave(String id) => _run(() async {
        final r = await _dio.get<Map<String, dynamic>>('/hr/me/leaves/$id');
        return HrLeaveRequest.fromJson(_data(r));
      });

  Future<HrLeaveRequest> applyLeave({
    required String leaveTypeId,
    required DateTime startDate,
    required DateTime endDate,
    required DayPart dayPart,
    required String reason,
  }) =>
      _run(() async {
        final r = await _dio.post<Map<String, dynamic>>(
          '/hr/me/leaves',
          data: {
            ..._leaveBody(leaveTypeId, startDate, endDate, dayPart),
            'reason': reason.trim(),
          },
        );
        return HrLeaveRequest.fromJson(_data(r));
      });

  Future<HrLeaveRequest> cancelMyLeave(String id, {String? remark}) =>
      _run(() async {
        final r = await _dio.post<Map<String, dynamic>>(
          '/hr/me/leaves/$id/cancel',
          data: {
            if (remark != null && remark.trim().isNotEmpty)
              'remark': remark.trim(),
          },
        );
        return HrLeaveRequest.fromJson(_data(r));
      });

  // ── self: payslips + inbox ────────────────────────────────────────────────

  Future<PaginatedResult<HrPayslipSummary>> myPayslips({
    int page = 1,
    int limit = 20,
  }) =>
      _run(() async {
        final r = await _dio.get<Map<String, dynamic>>(
          '/hr/me/payslips',
          queryParameters: {'page': page, 'limit': limit},
        );
        return PaginatedResult.fromJson(_data(r), HrPayslipSummary.fromJson);
      });

  Future<HrPayslip> myPayslip(String id) => _run(() async {
        final r = await _dio.get<Map<String, dynamic>>('/hr/me/payslips/$id');
        return HrPayslip.fromJson(_data(r));
      });

  Future<ReportExportFile> myPayslipPdf(String id, {required String month}) =>
      _pdf('/hr/me/payslips/$id/pdf', 'payslip-$month');

  Future<HrNotificationPage> myNotifications({
    int page = 1,
    int limit = 20,
    bool unreadOnly = false,
  }) =>
      _run(() async {
        final r = await _dio.get<Map<String, dynamic>>(
          '/hr/me/notifications',
          queryParameters: {
            'page': page,
            'limit': limit,
            if (unreadOnly) 'unreadOnly': true,
          },
        );
        return HrNotificationPage.fromJson(_data(r));
      });

  Future<void> markNotificationRead(String id) => _run(() async {
        await _dio.post<Map<String, dynamic>>(
          '/hr/me/notifications/$id/read',
          data: <String, dynamic>{},
        );
      });

  Future<void> markAllNotificationsRead() => _run(() async {
        await _dio.post<Map<String, dynamic>>(
          '/hr/me/notifications/read-all',
          data: <String, dynamic>{},
        );
      });

  // ── admin: overview + employees ───────────────────────────────────────────

  Future<HrOverview> overview() => _run(() async {
        final r = await _dio.get<Map<String, dynamic>>('/hr/overview');
        return HrOverview.fromJson(_data(r));
      });

  /// `limit` is capped at 200 on this endpoint.
  Future<PaginatedResult<HrEmployee>> employees({
    int page = 1,
    int limit = 20,
    String? search,
    String? status,
    String? branchId,
  }) =>
      _run(() async {
        final r = await _dio.get<Map<String, dynamic>>(
          '/hr/employees',
          queryParameters: {
            'page': page,
            'limit': limit,
            if (search != null && search.trim().isNotEmpty)
              'search': search.trim(),
            if (status != null) 'status': status,
            if (branchId != null) 'branchId': branchId,
          },
        );
        return PaginatedResult.fromJson(_data(r), HrEmployee.fromJson);
      });

  Future<HrEmployeeDetail> employee(String userId, {String? month}) =>
      _run(() async {
        final r = await _dio.get<Map<String, dynamic>>(
          '/hr/employees/$userId',
          queryParameters: {if (month != null) 'month': month},
        );
        return HrEmployeeDetail.fromJson(_data(r));
      });

  Future<HrMonthAttendance> employeeAttendance(
    String userId, {
    required String month,
  }) =>
      _run(() async {
        final r = await _dio.get<Map<String, dynamic>>(
          '/hr/employees/$userId/attendance',
          queryParameters: {'month': month},
        );
        return HrMonthAttendance.fromJson(_data(r));
      });

  // ── admin: attendance ─────────────────────────────────────────────────────

  /// The whole team for one day (`YYYY-MM-DD`; default today).
  Future<HrDayBoard> dayBoard({
    String? date,
    String? search,
    String? branchId,
  }) =>
      _run(() async {
        final r = await _dio.get<Map<String, dynamic>>(
          '/hr/attendance',
          queryParameters: {
            if (date != null) 'date': date,
            if (search != null && search.trim().isNotEmpty)
              'search': search.trim(),
            if (branchId != null) 'branchId': branchId,
          },
        );
        return HrDayBoard.fromJson(_data(r));
      });

  /// Manual mark / override of one employee-day. [remark] is REQUIRED
  /// (3-300 chars); times (`HH:mm`, IST) only with present/late/half-day.
  Future<HrAttendanceDay> markAttendance({
    required String userId,
    required String date,
    required DayStatus status,
    required String remark,
    String? checkInTime,
    String? checkOutTime,
  }) =>
      _run(() async {
        final r = await _dio.put<Map<String, dynamic>>(
          '/hr/attendance',
          data: {
            'userId': userId,
            'date': date,
            'status': status.api,
            if (status.acceptsTimes && checkInTime != null)
              'checkInTime': checkInTime,
            if (status.acceptsTimes && checkOutTime != null)
              'checkOutTime': checkOutTime,
            'remark': remark.trim(),
          },
        );
        return HrAttendanceDay.fromJson(_data(r));
      });

  /// Removes the recorded row; the day falls back to its computed status.
  Future<DayStatus> clearAttendance({
    required String userId,
    required String date,
    required String remark,
  }) =>
      _run(() async {
        final r = await _dio.delete<Map<String, dynamic>>(
          '/hr/attendance',
          queryParameters: {
            'userId': userId,
            'date': date,
            'remark': remark.trim(),
          },
        );
        return DayStatus.parse(_data(r)['status']);
      });

  // ── admin: leave ──────────────────────────────────────────────────────────

  Future<HrLeavePage> leaves({
    int page = 1,
    int limit = 20,
    LeaveStatus? status,
    String? userId,
  }) =>
      _run(() async {
        final r = await _dio.get<Map<String, dynamic>>(
          '/hr/leaves',
          queryParameters: {
            'page': page,
            'limit': limit,
            if (status != null) 'status': status.api,
            if (userId != null) 'userId': userId,
          },
        );
        return HrLeavePage.fromJson(_data(r));
      });

  Future<HrLeaveDetail> leaveDetail(String id) => _run(() async {
        final r = await _dio.get<Map<String, dynamic>>('/hr/leaves/$id');
        return HrLeaveDetail.fromJson(_data(r));
      });

  /// Optional [remark] (<= 500).
  Future<HrLeaveRequest> approveLeave(String id, {String? remark}) =>
      _run(() async {
        final r = await _dio.post<Map<String, dynamic>>(
          '/hr/leaves/$id/approve',
          data: {
            if (remark != null && remark.trim().isNotEmpty)
              'remark': remark.trim(),
          },
        );
        return HrLeaveRequest.fromJson(_data(r));
      });

  /// [remark] is REQUIRED (3-500 chars).
  Future<HrLeaveRequest> rejectLeave(String id, {required String remark}) =>
      _run(() async {
        final r = await _dio.post<Map<String, dynamic>>(
          '/hr/leaves/$id/reject',
          data: {'remark': remark.trim()},
        );
        return HrLeaveRequest.fromJson(_data(r));
      });

  /// [remark] is REQUIRED (3-300 chars). PENDING or APPROVED.
  Future<HrLeaveRequest> cancelLeave(String id, {required String remark}) =>
      _run(() async {
        final r = await _dio.post<Map<String, dynamic>>(
          '/hr/leaves/$id/cancel',
          data: {'remark': remark.trim()},
        );
        return HrLeaveRequest.fromJson(_data(r));
      });

  Future<List<HrLeaveType>> leaveTypes() => _run(() async {
        final r = await _dio.get<Map<String, dynamic>>('/hr/leave-types');
        return _list(r, HrLeaveType.fromJson);
      });

  Future<HrLeavePreview> previewLeaveFor({
    required String userId,
    required String leaveTypeId,
    required DateTime startDate,
    required DateTime endDate,
    required DayPart dayPart,
  }) =>
      _run(() async {
        final r = await _dio.post<Map<String, dynamic>>(
          '/hr/leaves/preview',
          data: {
            'userId': userId,
            ..._leaveBody(leaveTypeId, startDate, endDate, dayPart),
          },
        );
        return HrLeavePreview.fromJson(_data(r));
      });

  /// Apply on behalf. `autoApprove` applies + approves in one step (never for
  /// the caller's own userId - the server answers 403).
  Future<HrLeaveRequest> applyLeaveFor({
    required String userId,
    required String leaveTypeId,
    required DateTime startDate,
    required DateTime endDate,
    required DayPart dayPart,
    required String reason,
    bool autoApprove = false,
    String? remark,
  }) =>
      _run(() async {
        final r = await _dio.post<Map<String, dynamic>>(
          '/hr/leaves',
          data: {
            'userId': userId,
            ..._leaveBody(leaveTypeId, startDate, endDate, dayPart),
            'reason': reason.trim(),
            if (autoApprove) 'autoApprove': true,
            if (autoApprove && remark != null && remark.trim().isNotEmpty)
              'remark': remark.trim(),
          },
        );
        return HrLeaveRequest.fromJson(_data(r));
      });

  // ── admin: payroll (read + pay actions only) ──────────────────────────────

  Future<PaginatedResult<HrPayrollRun>> payrollRuns({
    int page = 1,
    int limit = 20,
  }) =>
      _run(() async {
        final r = await _dio.get<Map<String, dynamic>>(
          '/hr/payroll/runs',
          queryParameters: {'page': page, 'limit': limit},
        );
        return PaginatedResult.fromJson(_data(r), HrPayrollRun.fromJson);
      });

  Future<HrPayrollRunDetail> payrollRun(String id) => _run(() async {
        final r = await _dio.get<Map<String, dynamic>>('/hr/payroll/runs/$id');
        return HrPayrollRunDetail.fromJson(_data(r));
      });

  Future<HrPayslip> payrollPayslip(String id) => _run(() async {
        final r = await _dio.get<Map<String, dynamic>>(
          '/hr/payroll/payslips/$id',
        );
        return HrPayslip.fromJson(_data(r));
      });

  Future<ReportExportFile> payrollPayslipPdf(
    String id, {
    required String month,
  }) =>
      _pdf('/hr/payroll/payslips/$id/pdf', 'payslip-$month');

  /// Marks one payslip paid (the run must be APPROVED). The server creates the
  /// matching SALARY expense; 409 `ALREADY_PAID` on a second attempt.
  Future<HrPayslip> payPayslip(
    String id, {
    required PaymentMode mode,
    String? paidOn,
    String? remark,
  }) =>
      _run(() async {
        final r = await _dio.post<Map<String, dynamic>>(
          '/hr/payroll/payslips/$id/pay',
          data: _payBody(mode, paidOn, remark),
        );
        return HrPayslip.fromJson(_data(r));
      });

  Future<HrPayAllResult> payAll(
    String runId, {
    required PaymentMode mode,
    String? paidOn,
    String? remark,
  }) =>
      _run(() async {
        final r = await _dio.post<Map<String, dynamic>>(
          '/hr/payroll/runs/$runId/pay-all',
          data: _payBody(mode, paidOn, remark),
        );
        return HrPayAllResult.fromJson(_data(r));
      });

  // ── helpers ───────────────────────────────────────────────────────────────

  static Map<String, dynamic> _payBody(
    PaymentMode mode,
    String? paidOn,
    String? remark,
  ) =>
      {
        'paymentMode': mode.api,
        if (paidOn != null) 'paidOn': paidOn,
        if (remark != null && remark.trim().isNotEmpty) 'remark': remark.trim(),
      };

  static Map<String, dynamic> _leaveBody(
    String leaveTypeId,
    DateTime start,
    DateTime end,
    DayPart part,
  ) =>
      {
        'leaveTypeId': leaveTypeId,
        'startDate': _iso(start),
        'endDate': _iso(end),
        'dayPart': part.api,
      };

  static String _iso(DateTime d) =>
      '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

  static Map<String, dynamic> _data(Response<Map<String, dynamic>> r) =>
      r.data!['data'] as Map<String, dynamic>;

  static List<T> _list<T>(
    Response<Map<String, dynamic>> r,
    T Function(Map<String, dynamic>) f,
  ) {
    final data = r.data!['data'];
    return data is List
        ? data.whereType<Map<String, dynamic>>().map(f).toList()
        : <T>[];
  }

  /// PDF bytes -> a [ReportExportFile] for the share sheet. A failed request
  /// still carries the JSON error envelope (as bytes), decoded for its message.
  Future<ReportExportFile> _pdf(String path, String baseName) async {
    try {
      final r = await _dio.get<List<int>>(
        path,
        options: Options(
          responseType: ResponseType.bytes,
          headers: {'Accept': 'application/pdf, application/json;q=0.5'},
        ),
      );
      final raw = r.data ?? const <int>[];
      final bytes = raw is Uint8List ? raw : Uint8List.fromList(raw);
      if (bytes.isEmpty) {
        throw const ApiException(
          message: 'The server returned an empty file. Try again.',
        );
      }
      return ReportExportFile(
        bytes: bytes,
        format: ReportExportFormat.pdf,
        filename: '$baseName.pdf',
      );
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<T> _run<T>(Future<T> Function() body) async {
    try {
      return await body();
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  static ApiException _mapError(DioException e) {
    if (e.type == DioExceptionType.connectionError ||
        e.type == DioExceptionType.connectionTimeout) {
      return ApiException.network();
    }
    var data = e.response?.data;
    // A failed PDF request still carries the JSON envelope - as bytes.
    if (data is List<int>) {
      try {
        data = jsonDecode(utf8.decode(data));
      } catch (_) {
        data = null;
      }
    }
    return ApiException.fromResponseData(data, e.response?.statusCode);
  }
}
