import 'package:dio/dio.dart';

import '../core/network/api_exception.dart';
import '../models/diet_plan_summary.dart';
import '../models/paginated_result.dart';

class DietPlanRepository {
  DietPlanRepository(this._dio);

  final Dio _dio;

  Future<PaginatedResult<DietPlanSummary>> list({
    int page = 1,
    int limit = 20,
  }) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        '/diet-plans',
        queryParameters: {'page': page, 'limit': limit},
      );
      return PaginatedResult.fromJson(
        response.data!['data'] as Map<String, dynamic>,
        DietPlanSummary.fromJson,
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
