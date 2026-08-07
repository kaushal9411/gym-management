import 'package:dio/dio.dart';

import '../../../core/errors/app_exception.dart';
import 'models/member.dart';

class MemberRepository {
  final Dio _dio;
  MemberRepository(this._dio);

  Future<MemberListPage> list({int page = 1, String? search}) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        '/members',
        queryParameters: {
          'page': page,
          'limit': 20,
          if (search != null && search.isNotEmpty) 'search': search,
        },
      );
      return MemberListPage.fromJson(
        response.data!['data'] as Map<String, dynamic>,
      );
    } on DioException catch (e) {
      throw AppException.fromDioData(e.response?.data, e.response?.statusCode);
    }
  }

  Future<MemberDetail> getById(String id) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>('/members/$id');
      return MemberDetail.fromJson(
        response.data!['data'] as Map<String, dynamic>,
      );
    } on DioException catch (e) {
      throw AppException.fromDioData(e.response?.data, e.response?.statusCode);
    }
  }
}
