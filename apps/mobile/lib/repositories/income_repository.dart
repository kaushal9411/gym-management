import 'package:dio/dio.dart';

import '../core/network/api_exception.dart';
import '../models/income_entry.dart';
import '../models/paginated_result.dart';

class IncomeRepository {
  IncomeRepository(this._dio);

  final Dio _dio;

  Future<PaginatedResult<IncomeEntry>> list({
    int page = 1,
    int limit = 20,
  }) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        '/income',
        queryParameters: {'page': page, 'limit': limit},
      );
      return PaginatedResult.fromJson(
        response.data!['data'] as Map<String, dynamic>,
        IncomeEntry.fromJson,
      );
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

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
          'incomeDate': incomeDate.toIso8601String(),
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
