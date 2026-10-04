import 'package:dio/dio.dart';

import '../core/network/api_exception.dart';
import '../models/expense_entry.dart';
import '../models/ledger_analytics.dart';
import '../models/paginated_result.dart';

class ExpenseRepository {
  ExpenseRepository(this._dio);

  final Dio _dio;

  Future<PaginatedResult<ExpenseEntry>> list({
    int page = 1,
    int limit = 20,
  }) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        '/expenses',
        queryParameters: {'page': page, 'limit': limit},
      );
      return PaginatedResult.fromJson(
        response.data!['data'] as Map<String, dynamic>,
        ExpenseEntry.fromJson,
      );
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  /// [list] plus the filtered-set `summary` (separate so the generic
  /// `PaginatedListCubit` closure can keep using the page envelope).
  Future<({PaginatedResult<ExpenseEntry> page, LedgerListSummary? summary})>
      listWithSummary({int page = 1, int limit = 20}) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        '/expenses',
        queryParameters: {'page': page, 'limit': limit},
      );
      final data = response.data!['data'] as Map<String, dynamic>;
      final summary = data['summary'];
      return (
        page: PaginatedResult.fromJson(data, ExpenseEntry.fromJson),
        summary: summary is Map<String, dynamic>
            ? LedgerListSummary.fromJson(summary)
            : null,
      );
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  /// `GET /expenses/analytics` (perm `finance:view`; 403 for others).
  Future<LedgerAnalytics> analytics({
    required String dateFrom,
    required String dateTo,
    String? branchId,
  }) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        '/expenses/analytics',
        queryParameters: {
          'dateFrom': dateFrom,
          'dateTo': dateTo,
          if (branchId != null) 'branchId': branchId,
        },
      );
      return LedgerAnalytics.fromJson(
        response.data!['data'] as Map<String, dynamic>,
      );
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<ExpenseEntry> create({
    required ExpenseCategory category,
    required double amount,
    required DateTime expenseDate,
    String? description,
  }) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        '/expenses',
        data: {
          'category': category.apiValue,
          'amount': amount,
          'expenseDate': expenseDate.toIso8601String(),
          if (description != null && description.isNotEmpty)
            'description': description,
        },
      );
      return ExpenseEntry.fromJson(
        response.data!['data'] as Map<String, dynamic>,
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
