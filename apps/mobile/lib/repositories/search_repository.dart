import 'package:dio/dio.dart';

import '../core/network/api_exception.dart';
import '../models/global_search_result.dart';

class SearchRepository {
  SearchRepository(this._dio);

  final Dio _dio;

  /// The backend itself no-ops queries under 2 characters (returns all-empty
  /// categories rather than erroring), so nothing extra is needed here for
  /// a short query.
  Future<GlobalSearchResult> search(String query) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        '/search',
        queryParameters: {'q': query},
      );
      return GlobalSearchResult.fromJson(
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
