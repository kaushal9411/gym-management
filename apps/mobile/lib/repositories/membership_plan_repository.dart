import 'package:dio/dio.dart';

import '../core/network/api_exception.dart';
import '../models/membership_plan.dart';
import '../models/paginated_result.dart';

class MembershipPlanFormInput {
  const MembershipPlanFormInput({
    required this.name,
    required this.price,
    required this.duration,
    this.includePt = false,
    this.includeDiet = false,
    this.includeGroupClasses = false,
    this.includeLocker = false,
  });

  final String name;
  final double price;
  final PlanDuration duration;
  final bool includePt;
  final bool includeDiet;
  final bool includeGroupClasses;
  final bool includeLocker;

  Map<String, dynamic> toJson() => {
        'name': name,
        'price': price,
        'durationValue': duration.value,
        'durationType': duration.apiType,
        'ptSessionsIncluded': includePt ? 1 : 0,
        'groupClassesIncluded': includeGroupClasses ? 1 : 0,
        'dietConsultationIncluded': includeDiet,
        'lockerAccess': includeLocker,
      };
}

class MembershipPlanRepository {
  MembershipPlanRepository(this._dio);

  final Dio _dio;

  Future<PaginatedResult<MembershipPlan>> list({
    int page = 1,
    int limit = 20,
  }) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        '/membership-plans',
        queryParameters: {'page': page, 'limit': limit},
      );
      return PaginatedResult.fromJson(
        response.data!['data'] as Map<String, dynamic>,
        MembershipPlan.fromJson,
      );
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<MembershipPlan> create(MembershipPlanFormInput input) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        '/membership-plans',
        data: input.toJson(),
      );
      return MembershipPlan.fromJson(
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
