import 'package:dio/dio.dart';

import '../core/network/api_exception.dart';
import '../models/income_entry.dart';
import '../models/ledger_analytics.dart';
import '../models/paginated_result.dart';

class IncomeRepository {
  IncomeRepository(this._dio);

  final Dio _dio;

  /// Query for `GET /income` (`listIncomeQuerySchema`): every filter is
  /// optional; `category` is the UPPER_SNAKE api value, `sortBy` is
  /// `incomeDate` | `amount`, `sortDir` `asc` | `desc`.
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

  Future<PaginatedResult<IncomeEntry>> list({
    int page = 1,
    int limit = 20,
    String? branchId,
    String? dateFrom,
    String? dateTo,
    String? search,
    String? category,
    String? sortBy,
    String? sortDir,
  }) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        '/income',
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
      return PaginatedResult.fromJson(
        response.data!['data'] as Map<String, dynamic>,
        IncomeEntry.fromJson,
      );
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  /// [list] plus the filtered-set `summary` (separate so a page-only caller
  /// can keep using the page envelope).
  Future<({PaginatedResult<IncomeEntry> page, LedgerListSummary? summary})>
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
        '/income',
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
        page: PaginatedResult.fromJson(data, IncomeEntry.fromJson),
        summary: summary is Map<String, dynamic>
            ? LedgerListSummary.fromJson(summary)
            : null,
      );
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  /// `GET /income/analytics` (perm `finance:view`; 403 for others).
  Future<LedgerAnalytics> analytics({
    required String dateFrom,
    required String dateTo,
    String? branchId,
  }) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        '/income/analytics',
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

  /// `POST /income` (perm `finance:income-manage`). [incomeDate] goes out as
  /// a plain `YYYY-MM-DD` (the column is a date, not a timestamp) — exactly
  /// what web sends — so no timezone can shift the day.
  Future<IncomeEntry> create({
    required IncomeCategory category,
    required double amount,
    required DateTime incomeDate,
    String? description,
  }) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        '/income',
        data: {
          'category': category.apiValue,
          'amount': amount,
          'incomeDate': _ymd(incomeDate),
          if (description != null && description.isNotEmpty)
            'description': description,
        },
      );
      return IncomeEntry.fromJson(
        response.data!['data'] as Map<String, dynamic>,
      );
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  /// `DELETE /income/:id` (perm `finance:income-manage`) — a soft delete; the
  /// API refuses entries auto-created from a payment.
  Future<void> delete(String id) async {
    try {
      await _dio.delete<Object?>('/income/$id');
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
