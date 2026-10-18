import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';

import '../core/network/api_exception.dart';
import '../models/active_vs_inactive_row.dart';
import '../models/attendance_report_row.dart';
import '../models/branch_performance_row.dart';
import '../models/expense_report_row.dart';
import '../models/expiring_membership_row.dart';
import '../models/member_progress_row.dart';
import '../models/membership_report_row.dart';
import '../models/paginated_result.dart';
import '../models/payment_report_row.dart';
import '../models/payments_analytics.dart' show jsonMap, jsonMoney;
import '../models/report_export.dart';
import '../models/report_summary.dart';
import '../models/reports_overview.dart';
import '../models/revenue_report_row.dart';
import '../models/staff_report_row.dart';
import '../models/trainer_performance_row.dart';

class ReportsRepository {
  ReportsRepository(this._dio);

  final Dio _dio;

  Map<String, dynamic> _filters({
    DateTime? from,
    DateTime? to,
    String? branchId,
    String? memberStatus,
    String? paymentStatus,
    String? planId,
    int page = 1,
    int limit = 20,
  }) =>
      {
        if (from != null) 'dateFrom': from.toIso8601String().substring(0, 10),
        if (to != null) 'dateTo': to.toIso8601String().substring(0, 10),
        if (branchId != null) 'branchId': branchId,
        if (memberStatus != null) 'memberStatus': memberStatus,
        if (paymentStatus != null) 'paymentStatus': paymentStatus,
        if (planId != null) 'planId': planId,
        'page': page,
        'limit': limit,
      };

  /// Members with plan, status, and dates — no date-range filter server
  /// side (the endpoint doesn't apply `dateFrom`/`dateTo` at all).
  Future<PaginatedResult<MembershipReportRow>> membership({
    String? branchId,
    String? memberStatus,
    String? planId,
    int page = 1,
    int limit = 20,
  }) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        '/reports/membership',
        queryParameters: _filters(
          branchId: branchId,
          memberStatus: memberStatus,
          planId: planId,
          page: page,
          limit: limit,
        ),
      );
      return PaginatedResult.fromJson(
        response.data!['data'] as Map<String, dynamic>,
        MembershipReportRow.fromJson,
      );
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  /// `GET /reports/attendance` — every check-in in the range, newest first
  /// (perm `reports:view`). `attendanceDate` is a `@db.Date` column, so the
  /// plain `YYYY-MM-DD` bounds include the end day.
  Future<PaginatedResult<AttendanceReportRow>> attendance({
    DateTime? from,
    DateTime? to,
    String? branchId,
    int page = 1,
    int limit = 20,
  }) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        '/reports/attendance',
        queryParameters: _filters(
          from: from,
          to: to,
          branchId: branchId,
          page: page,
          limit: limit,
        ),
      );
      return PaginatedResult.fromJson(
        response.data!['data'] as Map<String, dynamic>,
        AttendanceReportRow.fromJson,
      );
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  /// Members, revenue, and attendance per branch — `branchId` narrows to
  /// one branch; omitted (the existing Revenue Report's usage) returns
  /// every branch the caller can see.
  Future<List<BranchPerformanceRow>> branchPerformance({
    String? branchId,
  }) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        '/reports/branch-performance',
        queryParameters: {if (branchId != null) 'branchId': branchId},
      );
      final list = response.data!['data'] as List;
      return list
          .map((e) => BranchPerformanceRow.fromJson(e as Map<String, dynamic>))
          .toList();
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  /// Aggregates payment method totals from the (up to 200 most recent)
  /// revenue rows in range — not a dedicated backend aggregation endpoint,
  /// so very high-volume tenants would see a "recent sample" rather than a
  /// true full-period total. Good enough for the Analytics donut's shape.
  Future<Map<String, double>> revenueByMethod({
    required DateTime from,
    required DateTime to,
    String? branchId,
  }) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        '/reports/revenue',
        queryParameters: {
          'dateFrom': from.toIso8601String().substring(0, 10),
          'dateTo': to.toIso8601String().substring(0, 10),
          'limit': 200,
          if (branchId != null) 'branchId': branchId,
        },
      );
      final data = response.data!['data'] as Map<String, dynamic>;
      final items = data['items'] as List;
      final totals = <String, double>{};
      for (final row in items) {
        final method = (row as Map<String, dynamic>)['method'] as String;
        final amount = double.parse(row['amount'] as String);
        totals[method] = (totals[method] ?? 0) + amount;
      }
      return totals;
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  /// Successful payments over time, plus the period total.
  Future<({PaginatedResult<RevenueReportRow> page, double totalAmount})>
      revenue({
    required DateTime from,
    required DateTime to,
    String? branchId,
    int page = 1,
    int limit = 20,
  }) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        '/reports/revenue',
        queryParameters: _filters(
          from: from,
          to: to,
          branchId: branchId,
          page: page,
          limit: limit,
        ),
      );
      final data = response.data!['data'] as Map<String, dynamic>;
      return (
        page: PaginatedResult.fromJson(data, RevenueReportRow.fromJson),
        totalAmount: jsonMoney(data['totalAmount']),
      );
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  /// Recorded expenses over time, plus the period total.
  Future<({PaginatedResult<ExpenseReportRow> page, double totalAmount})>
      expenses({
    required DateTime from,
    required DateTime to,
    String? branchId,
    int page = 1,
    int limit = 20,
  }) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        '/reports/expenses',
        queryParameters: _filters(
          from: from,
          to: to,
          branchId: branchId,
          page: page,
          limit: limit,
        ),
      );
      final data = response.data!['data'] as Map<String, dynamic>;
      return (
        page: PaginatedResult.fromJson(data, ExpenseReportRow.fromJson),
        totalAmount: jsonMoney(data['totalAmount']),
      );
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  /// Every payment, with status.
  Future<PaginatedResult<PaymentReportRow>> payments({
    DateTime? from,
    DateTime? to,
    String? branchId,
    String? paymentStatus,
    int page = 1,
    int limit = 20,
  }) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        '/reports/payments',
        queryParameters: _filters(
          from: from,
          to: to,
          branchId: branchId,
          paymentStatus: paymentStatus,
          page: page,
          limit: limit,
        ),
      );
      return PaginatedResult.fromJson(
        response.data!['data'] as Map<String, dynamic>,
        PaymentReportRow.fromJson,
      );
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  /// Managers, trainers, and receptionists — no date range server side.
  Future<PaginatedResult<StaffReportRow>> staff({
    String? branchId,
    int page = 1,
    int limit = 20,
  }) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        '/reports/staff',
        queryParameters: _filters(branchId: branchId, page: page, limit: limit),
      );
      return PaginatedResult.fromJson(
        response.data!['data'] as Map<String, dynamic>,
        StaffReportRow.fromJson,
      );
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<List<TrainerPerformanceRow>> trainerPerformance({
    String? branchId,
  }) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        '/reports/trainer-performance',
        queryParameters: {if (branchId != null) 'branchId': branchId},
      );
      final list = response.data!['data'] as List;
      return list
          .map((e) => TrainerPerformanceRow.fromJson(e as Map<String, dynamic>))
          .toList();
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  /// Workout and diet adherence, per member's active assignments.
  Future<PaginatedResult<MemberProgressRow>> memberProgress({
    String? branchId,
    int page = 1,
    int limit = 20,
  }) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        '/reports/member-progress',
        queryParameters: _filters(branchId: branchId, page: page, limit: limit),
      );
      return PaginatedResult.fromJson(
        response.data!['data'] as Map<String, dynamic>,
        MemberProgressRow.fromJson,
      );
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  /// Active memberships ending within 30 days (server default window).
  Future<PaginatedResult<ExpiringMembershipRow>> expiringMemberships({
    String? branchId,
    int page = 1,
    int limit = 20,
  }) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        '/reports/expiring-memberships',
        queryParameters: _filters(branchId: branchId, page: page, limit: limit),
      );
      return PaginatedResult.fromJson(
        response.data!['data'] as Map<String, dynamic>,
        ExpiringMembershipRow.fromJson,
      );
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<List<ActiveVsInactiveRow>> activeVsInactive({String? branchId}) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        '/reports/active-vs-inactive',
        queryParameters: {if (branchId != null) 'branchId': branchId},
      );
      final list = response.data!['data'] as List;
      return list
          .map((e) => ActiveVsInactiveRow.fromJson(e as Map<String, dynamic>))
          .toList();
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  String _day(DateTime d) => d.toIso8601String().substring(0, 10);

  /// `GET /reports/overview` — KPIs vs previous period, daily series,
  /// weekday/hourly attendance, status/plan/method/branch/trainer/expiring
  /// blocks. Perm `reports:view` (403 for others — callers hide the UI).
  /// Dates are UTC `YYYY-MM-DD` strings (the API buckets by UTC day).
  Future<ReportsOverview> overview({
    String? dateFrom,
    String? dateTo,
    String? branchId,
  }) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        '/reports/overview',
        queryParameters: {
          if (dateFrom != null) 'dateFrom': dateFrom,
          if (dateTo != null) 'dateTo': dateTo,
          if (branchId != null) 'branchId': branchId,
        },
      );
      return ReportsOverview.fromJson(jsonMap(response.data!['data']));
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  /// `GET /reports/:type/summary` — [type] is one of the 11 list report
  /// path segments (`membership`, `attendance`, `revenue`, `expenses`,
  /// `payments`, `staff`, `trainer-performance`, `member-progress`,
  /// `branch-performance`, `expiring-memberships`, `active-vs-inactive`).
  /// Same filter names as the lists, no paging.
  Future<ReportSummary> summary(
    String type, [
    ReportSummaryFilters filters = const ReportSummaryFilters(),
  ]) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        '/reports/$type/summary',
        queryParameters: _filterQuery(filters),
      );
      return ReportSummary.fromJson(jsonMap(response.data!['data']));
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  /// The report filters as query parameters (plain `YYYY-MM-DD` days, only
  /// the ones that are set) — shared by `summary` and `exportReport`.
  Map<String, dynamic> _filterQuery(ReportSummaryFilters filters) => {
        if (filters.from != null) 'dateFrom': _day(filters.from!),
        if (filters.to != null) 'dateTo': _day(filters.to!),
        if (filters.branchId != null) 'branchId': filters.branchId,
        if (filters.planId != null) 'planId': filters.planId,
        if (filters.trainerId != null) 'trainerId': filters.trainerId,
        if (filters.memberStatus != null) 'memberStatus': filters.memberStatus,
        if (filters.paymentStatus != null)
          'paymentStatus': filters.paymentStatus,
      };

  /// `GET /reports/:reportType/export?format=csv|xlsx|pdf&<filters>`
  /// (perm `reports:export`) — the same files web's `ExportButtons`
  /// downloads. [reportType] is any of the API's 18 ids: the 11 list reports
  /// (`membership`, `attendance`, `revenue`, `expenses`, `payments`, `staff`,
  /// `trainer-performance`, `member-progress`, `branch-performance`,
  /// `expiring-memberships`, `active-vs-inactive`) and the 7
  /// `analytics-*` views. [filters] are the screen's current report filters
  /// (the server accepts dateFrom / dateTo / branchId / planId / trainerId /
  /// paymentStatus / memberStatus; paging is ignored — it exports up to 2000
  /// rows).
  ///
  /// The body is read as bytes. The server renders PDFs / workbooks in a
  /// worker and large ranges can take a while, hence the generous receive
  /// timeout. A failed request still carries the JSON error envelope — as
  /// bytes — which is decoded so the server's own message is shown.
  Future<ReportExportFile> exportReport(
    String reportType,
    ReportExportFormat format, [
    ReportSummaryFilters filters = const ReportSummaryFilters(),
  ]) async {
    try {
      final response = await _dio.get<List<int>>(
        '/reports/$reportType/export',
        queryParameters: {
          ..._filterQuery(filters),
          'format': format.apiValue,
        },
        options: Options(
          responseType: ResponseType.bytes,
          receiveTimeout: const Duration(minutes: 3),
          headers: {'Accept': '${format.mimeType}, application/json;q=0.5'},
        ),
      );
      final contentType = response.headers.value(Headers.contentTypeHeader);
      final raw = response.data ?? const <int>[];
      final bytes = raw is Uint8List ? raw : Uint8List.fromList(raw);
      // A 2xx that is really a JSON envelope (proxy / gateway rewrite).
      if (contentType != null && contentType.contains('application/json')) {
        throw _exportFailure(bytes, response.statusCode);
      }
      if (bytes.isEmpty) {
        throw const ApiException(
          message: 'The server returned an empty file. Try again.',
        );
      }
      return ReportExportFile(
        bytes: bytes,
        format: format,
        filename: exportFilename(
          response.headers.value('content-disposition'),
          reportType: reportType,
          format: format,
        ),
      );
    } on DioException catch (e) {
      if (e.type == DioExceptionType.receiveTimeout ||
          e.type == DioExceptionType.sendTimeout) {
        throw const ApiException(
          message: 'The export took too long. Try a shorter period or a '
              'single branch, then try again.',
        );
      }
      final data = e.response?.data;
      if (data is List<int>) {
        throw _exportFailure(data, e.response?.statusCode);
      }
      throw _mapError(e);
    }
  }

  /// Decodes a JSON error envelope that arrived as bytes (the export call's
  /// `ResponseType.bytes` turns every body into bytes, errors included).
  ApiException _exportFailure(List<int> body, int? statusCode) {
    try {
      final decoded = jsonDecode(utf8.decode(body, allowMalformed: true));
      if (decoded is Map<String, dynamic>) {
        return ApiException.fromResponseData(decoded, statusCode);
      }
    } catch (_) {
      // Not JSON (HTML error page, empty body) — generic message below.
    }
    return ApiException(
      message: statusCode == 403
          ? 'You do not have permission to export reports.'
          : 'The export failed. Please try again.',
      statusCode: statusCode,
    );
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
