import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';

import '../core/network/api_exception.dart';
import '../models/hr_admin.dart';
import '../models/hr_attendance.dart';
import '../models/hr_enums.dart';
import '../models/hr_leave.dart';
import '../models/hr_payroll.dart';
import '../models/hr_setup.dart';
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

  /// `true` for the 409 `ALREADY_EMPLOYEE` of [enrollMe] (a StaffProfile
  /// already exists - just reload).
  static bool isAlreadyEmployee(Object e) =>
      e is ApiException && e.statusCode == 409 && e.code == 'ALREADY_EMPLOYEE';

  // ── self: attendance ──────────────────────────────────────────────────────

  /// Opt-in enrolment (`POST /hr/me/enroll`, no body; needs
  /// `hr:self_attendance` or `hr:self_leave`): gives an account that has no
  /// StaffProfile - the OWNER - an employee profile. 201 returns the same
  /// shape as [meSummary]; 409 `ALREADY_EMPLOYEE` when one exists
  /// ([isAlreadyEmployee]). Not undoable from the app.
  Future<HrMeSummary> enrollMe() => _run(() async {
        final r = await _dio.post<Map<String, dynamic>>('/hr/me/enroll');
        return HrMeSummary.fromJson(_data(r));
      });

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
    String? leaveTypeId,
    DateTime? from,
    DateTime? to,
  }) =>
      _run(() async {
        final r = await _dio.get<Map<String, dynamic>>(
          '/hr/leaves',
          queryParameters: {
            'page': page,
            'limit': limit,
            if (status != null) 'status': status.api,
            if (userId != null) 'userId': userId,
            if (leaveTypeId != null) 'leaveTypeId': leaveTypeId,
            if (from != null) 'from': _iso(from),
            if (to != null) 'to': _iso(to),
          },
        );
        return HrLeavePage.fromJson(_data(r));
      });

  /// "Who is off when" for the team calendar (`GET /hr/leaves/calendar`,
  /// `hr:leave_manage`). The window must be 1-62 days (422 otherwise).
  Future<HrLeaveCalendar> leaveCalendar(DateTime from, DateTime to) =>
      _run(() async {
        final r = await _dio.get<Map<String, dynamic>>(
          '/hr/leaves/calendar',
          queryParameters: {'from': _iso(from), 'to': _iso(to)},
        );
        return HrLeaveCalendar.fromJson(_data(r));
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

  Future<List<HrLeaveType>> leaveTypes({bool includeInactive = false}) =>
      _run(() async {
        final r = await _dio.get<Map<String, dynamic>>(
          '/hr/leave-types',
          queryParameters: {if (includeInactive) 'includeInactive': true},
        );
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

  // ── admin: payroll ────────────────────────────────────────────────────────

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

  /// `POST /hr/payroll/runs` - one DRAFT payslip per eligible employee.
  /// 409 `CONFLICT` when the month already has a run; 422 for a future month.
  Future<HrPayrollRunDetail> generatePayroll(
    String month, {
    String? notes,
  }) =>
      _run(() async {
        final r = await _dio.post<Map<String, dynamic>>(
          '/hr/payroll/runs',
          data: {
            'month': month,
            if (notes != null && notes.trim().isNotEmpty)
              'notes': notes.trim(),
          },
        );
        return HrPayrollRunDetail.fromJson(_data(r));
      });

  /// DRAFT only: recomputes every draft payslip (manual lines, bonus and
  /// advance recovery are kept).
  Future<HrPayrollRunDetail> recalculateRun(String id) => _run(() async {
        final r = await _dio.post<Map<String, dynamic>>(
          '/hr/payroll/runs/$id/recalculate',
          data: <String, dynamic>{},
        );
        return HrPayrollRunDetail.fromJson(_data(r));
      });

  /// DRAFT only (409 `INVALID_STATE` otherwise).
  Future<void> deleteRun(String id) => _run(() async {
        await _dio.delete<Map<String, dynamic>>('/hr/payroll/runs/$id');
      });

  /// DRAFT -> APPROVED; locks the run and makes payslips visible to staff.
  Future<HrPayrollRun> approveRun(String id) => _run(() async {
        final r = await _dio.post<Map<String, dynamic>>(
          '/hr/payroll/runs/$id/approve',
          data: <String, dynamic>{},
        );
        return HrPayrollRun.fromJson(_data(r));
      });

  /// Bonus / advance recovery / manual lines of a DRAFT payslip; the server
  /// answers with the payslip recomputed.
  Future<HrPayslip> patchPayslip(String id, HrPayslipEdit edit) =>
      _run(() async {
        final r = await _dio.patch<Map<String, dynamic>>(
          '/hr/payroll/payslips/$id',
          data: edit.toJson(),
        );
        return HrPayslip.fromJson(_data(r));
      });

  // ── admin: employee setup ─────────────────────────────────────────────────

  /// `hr:payroll_manage`.
  Future<HrPayStructure> payStructure(String userId) => _run(() async {
        final r = await _dio.get<Map<String, dynamic>>(
          '/hr/employees/$userId/pay-structure',
        );
        return HrPayStructure.fromJson(_data(r));
      });

  /// `components` replaces the whole set (max 20). Applies to the NEXT
  /// payroll generation / recalculation.
  Future<HrPayStructure> savePayStructure(
    String userId, {
    double? baseSalary,
    required List<HrPayComponent> components,
  }) =>
      _run(() async {
        final r = await _dio.put<Map<String, dynamic>>(
          '/hr/employees/$userId/pay-structure',
          data: {
            if (baseSalary != null) 'baseSalary': baseSalary,
            'components': [for (final c in components) c.toJson()],
          },
        );
        return HrPayStructure.fromJson(_data(r));
      });

  /// `shiftId == null` = the gym default shift; `weeklyOff == null` = inherit
  /// from the shift / policy.
  Future<HrWorkSetup> setWorkSetup(
    String userId, {
    String? shiftId,
    List<String>? weeklyOff,
  }) =>
      _run(() async {
        final r = await _dio.put<Map<String, dynamic>>(
          '/hr/employees/$userId/work-setup',
          data: {
            'shiftId': shiftId,
            'weeklyOff':
                weeklyOff == null ? null : HrWeekday.normalise(weeklyOff),
          },
        );
        return HrWorkSetup.fromJson(_data(r));
      });

  /// Credit (positive) / debit (negative) a leave balance. [remark] is
  /// REQUIRED (3-300). 409 on an unlimited type; 422 if entitlement would
  /// drop below used + pending.
  Future<HrLeaveBalance> adjustLeaveBalance({
    required String userId,
    required String leaveTypeId,
    required double days,
    required String remark,
    int? leaveYear,
  }) =>
      _run(() async {
        final r = await _dio.post<Map<String, dynamic>>(
          '/hr/leave-balances/adjust',
          data: {
            'userId': userId,
            'leaveTypeId': leaveTypeId,
            if (leaveYear != null) 'leaveYear': leaveYear,
            'days': days,
            'remark': remark.trim(),
          },
        );
        return HrLeaveBalance.fromJson(_data(r));
      });

  // ── admin: attendance grid + bulk ─────────────────────────────────────────

  Future<HrMonthlyGrid> monthlyGrid(String month, {String? branchId}) =>
      _run(() async {
        final r = await _dio.get<Map<String, dynamic>>(
          '/hr/attendance/monthly',
          queryParameters: {
            'month': month,
            if (branchId != null) 'branchId': branchId,
          },
        );
        return HrMonthlyGrid.fromJson(_data(r));
      });

  /// Marks every id in [userIds] PRESENT for [date] with one shared REQUIRED
  /// [remark] (1-200 entries); [checkInTime] (`HH:mm`) is optional.
  Future<HrBulkResult> bulkMarkPresent({
    required String date,
    required String remark,
    required List<String> userIds,
    String? checkInTime,
  }) =>
      _run(() async {
        final r = await _dio.post<Map<String, dynamic>>(
          '/hr/attendance/bulk',
          data: {
            'date': date,
            'remark': remark.trim(),
            'entries': [
              for (final id in userIds)
                {
                  'userId': id,
                  'status': DayStatus.present.api,
                  if (checkInTime != null) 'checkInTime': checkInTime,
                },
            ],
          },
        );
        return HrBulkResult.fromJson(_data(r));
      });

  // ── admin: setup (shifts, holidays, leave types, policy) ──────────────────

  Future<List<HrShift>> shifts() => _run(() async {
        final r = await _dio.get<Map<String, dynamic>>('/hr/shifts');
        return _list(r, HrShift.fromJson);
      });

  Future<HrShift> createShift(HrShiftInput input) => _run(() async {
        final r = await _dio.post<Map<String, dynamic>>(
          '/hr/shifts',
          data: input.toJson(),
        );
        return HrShift.fromJson(_data(r));
      });

  Future<HrShift> updateShift(String id, HrShiftInput input) =>
      _run(() async {
        final r = await _dio.patch<Map<String, dynamic>>(
          '/hr/shifts/$id',
          data: input.toJson(),
        );
        return HrShift.fromJson(_data(r));
      });

  /// 409 `INVALID_STATE` for the default shift or one with employees.
  Future<void> deleteShift(String id) => _run(() async {
        await _dio.delete<Map<String, dynamic>>('/hr/shifts/$id');
      });

  Future<List<HrHoliday>> holidays({required int year}) => _run(() async {
        final r = await _dio.get<Map<String, dynamic>>(
          '/hr/holidays',
          queryParameters: {'year': year},
        );
        return _list(r, HrHoliday.fromJson);
      });

  /// 409 `CONFLICT` for a second holiday on the same date + branch scope.
  Future<HrHoliday> createHoliday({
    required DateTime date,
    required String name,
    String? description,
  }) =>
      _run(() async {
        final r = await _dio.post<Map<String, dynamic>>(
          '/hr/holidays',
          data: {
            'date': _iso(date),
            'name': name.trim(),
            if (description != null && description.trim().isNotEmpty)
              'description': description.trim(),
          },
        );
        return HrHoliday.fromJson(_data(r));
      });

  Future<void> deleteHoliday(String id) => _run(() async {
        await _dio.delete<Map<String, dynamic>>('/hr/holidays/$id');
      });

  Future<HrLeaveType> createLeaveType(HrLeaveTypeInput input) =>
      _run(() async {
        final r = await _dio.post<Map<String, dynamic>>(
          '/hr/leave-types',
          data: input.toJson(),
        );
        return HrLeaveType.fromJson(_data(r));
      });

  Future<HrLeaveType> updateLeaveType(String id, HrLeaveTypeInput input) =>
      _run(() async {
        final r = await _dio.patch<Map<String, dynamic>>(
          '/hr/leave-types/$id',
          data: input.toJson(),
        );
        return HrLeaveType.fromJson(_data(r));
      });

  /// 409 `INVALID_STATE` when a request / balance uses the type (deactivate
  /// it instead).
  Future<void> deleteLeaveType(String id) => _run(() async {
        await _dio.delete<Map<String, dynamic>>('/hr/leave-types/$id');
      });

  Future<HrPolicy> policy() => _run(() async {
        final r = await _dio.get<Map<String, dynamic>>('/hr/policy');
        return HrPolicy.fromJson(_data(r));
      });

  Future<HrPolicy> savePolicy(HrPolicy policy) => _run(() async {
        final r = await _dio.put<Map<String, dynamic>>(
          '/hr/policy',
          data: policy.toJson(),
        );
        return HrPolicy.fromJson(_data(r));
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
