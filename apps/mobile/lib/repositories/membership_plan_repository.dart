import 'package:dio/dio.dart';

import '../core/network/api_exception.dart';
import '../models/membership_plan.dart';
import '../models/paginated_result.dart';

/// Full create/update field set — mirrors web's `PlanFormFields` exactly
/// (`createMembershipPlanSchema`/`updateMembershipPlanSchema`). One input
/// class for both create (`POST`) and update (`PATCH`): the mobile form
/// always submits the complete current state of every field, so there's no
/// need to distinguish "untouched" from "explicitly cleared."
class MembershipPlanFormInput {
  const MembershipPlanFormInput({
    required this.name,
    required this.durationValue,
    required this.durationType,
    required this.price,
    this.planCode,
    this.description,
    this.category,
    this.joiningFee,
    this.taxPercentage,
    this.discountPercentage,
    this.displayOrder,
    this.notes,
    this.gymAccessAllBranches = false,
    this.ptSessionsIncluded = 0,
    this.groupClassesIncluded = 0,
    this.dietConsultationIncluded = false,
    this.lockerAccess = false,
    this.guestPasses = 0,
    this.freezeAllowed = false,
    this.freezeDaysLimit,
    this.validityStart,
    this.validityEnd,
    this.gracePeriodDays,
    this.renewalWindowDays,
    this.autoRenewalAllowed = false,
    this.minAge,
    this.maxAge,
  });

  final String name;
  final String? planCode;
  final String? description;
  final String? category;
  final int durationValue;
  final MembershipDurationType durationType;
  final double price;
  final double? joiningFee;
  final double? taxPercentage;
  final double? discountPercentage;
  final int? displayOrder;
  final String? notes;
  final bool gymAccessAllBranches;
  final int ptSessionsIncluded;
  final int groupClassesIncluded;
  final bool dietConsultationIncluded;
  final bool lockerAccess;
  final int guestPasses;
  final bool freezeAllowed;
  final int? freezeDaysLimit;
  final DateTime? validityStart;
  final DateTime? validityEnd;
  final int? gracePeriodDays;
  final int? renewalWindowDays;
  final bool autoRenewalAllowed;
  final int? minAge;
  final int? maxAge;

  Map<String, dynamic> toJson() => {
        'name': name,
        if (planCode != null && planCode!.isNotEmpty) 'planCode': planCode,
        if (description != null) 'description': description,
        if (category != null) 'category': category,
        'durationValue': durationValue,
        'durationType': durationType.apiValue,
        'price': price,
        if (joiningFee != null) 'joiningFee': joiningFee,
        if (taxPercentage != null) 'taxPercentage': taxPercentage,
        if (discountPercentage != null)
          'discountPercentage': discountPercentage,
        if (displayOrder != null) 'displayOrder': displayOrder,
        if (notes != null) 'notes': notes,
        'gymAccessAllBranches': gymAccessAllBranches,
        'ptSessionsIncluded': ptSessionsIncluded,
        'groupClassesIncluded': groupClassesIncluded,
        'dietConsultationIncluded': dietConsultationIncluded,
        'lockerAccess': lockerAccess,
        'guestPasses': guestPasses,
        'freezeAllowed': freezeAllowed,
        if (freezeDaysLimit != null) 'freezeDaysLimit': freezeDaysLimit,
        if (validityStart != null)
          'validityStart': validityStart!.toIso8601String().substring(0, 10),
        if (validityEnd != null)
          'validityEnd': validityEnd!.toIso8601String().substring(0, 10),
        if (gracePeriodDays != null) 'gracePeriodDays': gracePeriodDays,
        if (renewalWindowDays != null) 'renewalWindowDays': renewalWindowDays,
        'autoRenewalAllowed': autoRenewalAllowed,
        if (minAge != null) 'minAge': minAge,
        if (maxAge != null) 'maxAge': maxAge,
      };
}

class MembershipPlanRepository {
  MembershipPlanRepository(this._dio);

  final Dio _dio;

  Future<PaginatedResult<MembershipPlan>> list({
    int page = 1,
    int limit = 20,
    String? search,
    bool? isActive,
    bool includeDeleted = false,
  }) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        '/membership-plans',
        queryParameters: {
          'page': page,
          'limit': limit,
          if (search != null && search.isNotEmpty) 'search': search,
          if (isActive != null) 'isActive': isActive,
          if (includeDeleted) 'includeDeleted': includeDeleted,
        },
      );
      return PaginatedResult.fromJson(
        response.data!['data'] as Map<String, dynamic>,
        MembershipPlan.fromJson,
      );
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<MembershipPlan> getById(String planId) async {
    try {
      final response =
          await _dio.get<Map<String, dynamic>>('/membership-plans/$planId');
      return MembershipPlan.fromJson(
        response.data!['data'] as Map<String, dynamic>,
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

  Future<MembershipPlan> update(
    String planId,
    MembershipPlanFormInput input,
  ) async {
    try {
      final response = await _dio.patch<Map<String, dynamic>>(
        '/membership-plans/$planId',
        data: input.toJson(),
      );
      return MembershipPlan.fromJson(
        response.data!['data'] as Map<String, dynamic>,
      );
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<void> activate(String planId) async {
    try {
      await _dio.post<void>('/membership-plans/$planId/activate');
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<void> deactivate(String planId) async {
    try {
      await _dio.post<void>('/membership-plans/$planId/deactivate');
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  /// Soft-delete — restorable, blocks future assignment while deleted.
  /// Members already on the plan are untouched.
  Future<void> delete(String planId) async {
    try {
      await _dio.delete<void>('/membership-plans/$planId');
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<void> restore(String planId) async {
    try {
      await _dio.post<void>('/membership-plans/$planId/restore');
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  /// Creates a copy named "{name} (Copy)" — always inactive.
  Future<MembershipPlan> duplicate(String planId) async {
    try {
      final response = await _dio
          .post<Map<String, dynamic>>('/membership-plans/$planId/duplicate');
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
