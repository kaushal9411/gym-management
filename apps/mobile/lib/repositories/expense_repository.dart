import 'package:dio/dio.dart';

import '../core/network/api_exception.dart';
import '../models/expense_entry.dart';
import '../models/ledger_analytics.dart';
import '../models/paginated_result.dart';

class ExpenseRepository {
  ExpenseRepository(this._dio);

  final Dio _dio;

  /// Query for `GET /expenses` (`listExpensesQuerySchema`): every filter is
  /// optional; `category` is the UPPER_SNAKE api value, `sortBy` is
  /// `expenseDate` | `amount`, `sortDir` `asc` | `desc`.
  static Map<String, dynamic> _query({
    required int page,
    required int limit,
    String? search,
    String? category,
    String? branchId,
    String? dateFrom,
    String? dateTo,
    String? sortBy,
    String? sortDir,
  }) =>
      {
        'page': page,
        'limit': limit,
        if (search != null && search.isNotEmpty) 'search': search,
        if (category != null && category.isNotEmpty) 'category': category,
        if (branchId != null) 'branchId': branchId,
        if (dateFrom != null) 'dateFrom': dateFrom,
        if (dateTo != null) 'dateTo': dateTo,
        if (sortBy != null) 'sortBy': sortBy,
        if (sortDir != null) 'sortDir': sortDir,
      };

  /// `GET /expenses` — the page plus the filtered-set `summary` (covers the
  /// whole filtered set, not just the loaded page).
  Future<({PaginatedResult<ExpenseEntry> page, LedgerListSummary? summary})>
      listWithSummary({
    int page = 1,
    int limit = 20,
    String? search,
    String? category,
    String? branchId,
    String? dateFrom,
    String? dateTo,
    String? sortBy,
    String? sortDir,
  }) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        '/expenses',
        queryParameters: _query(
          page: page,
          limit: limit,
          search: search,
          category: category,
          branchId: branchId,
          dateFrom: dateFrom,
          dateTo: dateTo,
          sortBy: sortBy,
          sortDir: sortDir,
        ),
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

  /// `POST /expenses` (perm `finance:expense-manage`). [expenseDate] goes out
  /// as a plain `YYYY-MM-DD` (the column is a date, not a timestamp) — exactly
  /// what web sends — so no timezone can shift the day. [receiptFileName] /
  /// [receiptDataUrl] (a base64 `data:` URL) are web's optional receipt.
  Future<ExpenseEntry> create({
    required ExpenseCategory category,
    required double amount,
    required DateTime expenseDate,
    String? description,
    String? receiptFileName,
    String? receiptDataUrl,
  }) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        '/expenses',
        data: {
          'category': category.apiValue,
          'amount': amount,
          'expenseDate': _ymd(expenseDate),
          if (description != null && description.isNotEmpty)
            'description': description,
          if (receiptDataUrl != null && receiptDataUrl.isNotEmpty) ...{
            'receiptFileName': (receiptFileName?.isNotEmpty ?? false)
                ? receiptFileName
                : 'receipt',
            'receiptDataUrl': receiptDataUrl,
          },
        },
      );
      return ExpenseEntry.fromJson(
        response.data!['data'] as Map<String, dynamic>,
      );
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  /// `DELETE /expenses/:id` (perm `finance:expense-manage`) — a soft delete.
  Future<void> delete(String id) async {
    try {
      await _dio.delete<Object?>('/expenses/$id');
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
