import 'package:dio/dio.dart';

import '../core/network/api_exception.dart';
import '../models/food.dart';
import '../models/paginated_result.dart';

class FoodRepository {
  FoodRepository(this._dio);

  final Dio _dio;

  Future<PaginatedResult<Food>> list({
    int page = 1,
    String? search,
    bool includeDeleted = false,
  }) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        '/foods',
        queryParameters: {
          'page': page,
          'limit': 20,
          if (search != null && search.isNotEmpty) 'search': search,
          if (includeDeleted) 'includeDeleted': includeDeleted,
        },
      );
      return PaginatedResult.fromJson(
        response.data!['data'] as Map<String, dynamic>,
        Food.fromJson,
      );
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  /// Unfiltered active list — backs food pickers (meal builder "+ Add").
  Future<List<Food>> active() async {
    try {
      final response = await _dio.get<Map<String, dynamic>>('/foods/active');
      final list = response.data!['data'] as List;
      return list.map((e) => Food.fromJson(e as Map<String, dynamic>)).toList();
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<Food> getById(String foodId) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>('/foods/$foodId');
      return Food.fromJson(response.data!['data'] as Map<String, dynamic>);
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<Food> create({
    required String name,
    String? category,
    String? servingSize,
    int? calories,
    double? protein,
    double? carbohydrates,
    double? fat,
    double? fiber,
    double? sugar,
    double? sodium,
    String? notes,
    bool? isActive,
  }) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        '/foods',
        data: {
          'name': name,
          if (category != null && category.isNotEmpty) 'category': category,
          if (servingSize != null && servingSize.isNotEmpty)
            'servingSize': servingSize,
          if (calories != null) 'calories': calories,
          if (protein != null) 'protein': protein,
          if (carbohydrates != null) 'carbohydrates': carbohydrates,
          if (fat != null) 'fat': fat,
          if (fiber != null) 'fiber': fiber,
          if (sugar != null) 'sugar': sugar,
          if (sodium != null) 'sodium': sodium,
          if (notes != null && notes.isNotEmpty) 'notes': notes,
          if (isActive != null) 'isActive': isActive,
        },
      );
      return Food.fromJson(response.data!['data'] as Map<String, dynamic>);
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<Food> update(
    String foodId, {
    String? name,
    String? category,
    String? servingSize,
    int? calories,
    double? protein,
    double? carbohydrates,
    double? fat,
    double? fiber,
    double? sugar,
    double? sodium,
    String? notes,
    bool? isActive,
  }) async {
    try {
      final response = await _dio.patch<Map<String, dynamic>>(
        '/foods/$foodId',
        data: {
          if (name != null) 'name': name,
          if (category != null) 'category': category,
          if (servingSize != null) 'servingSize': servingSize,
          if (calories != null) 'calories': calories,
          if (protein != null) 'protein': protein,
          if (carbohydrates != null) 'carbohydrates': carbohydrates,
          if (fat != null) 'fat': fat,
          if (fiber != null) 'fiber': fiber,
          if (sugar != null) 'sugar': sugar,
          if (sodium != null) 'sodium': sodium,
          if (notes != null) 'notes': notes,
          if (isActive != null) 'isActive': isActive,
        },
      );
      return Food.fromJson(response.data!['data'] as Map<String, dynamic>);
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  /// Soft-delete — plans that already use it are unaffected, but it can no
  /// longer be added to new meals until restored.
  Future<void> delete(String foodId) async {
    try {
      await _dio.delete<void>('/foods/$foodId');
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<void> restore(String foodId) async {
    try {
      await _dio.post<void>('/foods/$foodId/restore');
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
