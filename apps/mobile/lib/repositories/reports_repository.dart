import 'package:dio/dio.dart';

import '../core/network/api_exception.dart';
import '../models/active_vs_inactive_row.dart';
import '../models/branch_performance_row.dart';
import '../models/expense_report_row.dart';
import '../models/expiring_membership_row.dart';
import '../models/member_progress_row.dart';
import '../models/membership_report_row.dart';
import '../models/paginated_result.dart';
import '../models/payment_report_row.dart';
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
    int page = 1,
    int limit = 20,
  }) =>
      {
        if (from != null) 'dateFrom': from.toIso8601String().substring(0, 10),
        if (to != null) 'dateTo': to.toIso8601String().substring(0, 10),
        if (branchId != null) 'branchId': branchId,
        if (memberStatus != null) 'memberStatus': memberStatus,
        if (paymentStatus != null) 'paymentStatus': paymentStatus,
        'page': page,
        'limit': limit,
      };

  /// Members with plan, status, and dates — no date-range filter server
  /// side (the endpoint doesn't apply `dateFrom`/`dateTo` at all).
  Future<PaginatedResult<MembershipReportRow>> membership({
    String? branchId,
    String? memberStatus,
    int page = 1,
    int limit = 20,
  }) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        '/reports/membership',
        queryParameters: _filters(
          branchId: branchId,
          memberStatus: memberStatus,
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
        totalAmount: double.parse(data['totalAmount'] as String),
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
        totalAmount: double.parse(data['totalAmount'] as String),
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
